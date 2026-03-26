const express = require('express');
const multer = require('multer');
const sqldb = require('./../../db');
const helpers = require('./../../helpers');
const parseHashtags = require('./../../helpers/parseHashtags');
const { TIL_BASE_QUERY } = require('./../../helpers/queries');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// API key authentication middleware
function authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'Missing X-API-Key header' });
    }

    const user = helpers.getUserByApiKey(apiKey);
    if (!user) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    req.apiUser = user;
    next();
}

router.use(authenticateApiKey);


// GET /api/v1/til/search?type=title|text|tag|date&q=searchterm
router.get('/til/search', function (req, res) {
    const searchtype = req.query.type;
    const search = req.query.q;

    if (!searchtype || !search) {
        return res.status(400).json({ error: 'type and q query parameters are required' });
    }

    if (!['title', 'text', 'tag', 'date'].includes(searchtype)) {
        return res.status(400).json({ error: 'type must be one of: title, text, tag, date' });
    }

    let rows;

    if (searchtype === 'title') {
        rows = sqldb.prepare(`${TIL_BASE_QUERY}
            JOIN tils_fts ON tils_fts.rowid = tils.id
            WHERE tils.user_id = ? AND tils_fts.title MATCH ?
            GROUP BY tils.id ORDER BY rank`).all(req.apiUser.id, `"${search.replace(/"/g, '""')}"`);
    } else if (searchtype === 'text') {
        rows = sqldb.prepare(`${TIL_BASE_QUERY}
            JOIN tils_fts ON tils_fts.rowid = tils.id
            WHERE tils.user_id = ? AND tils_fts.description MATCH ?
            GROUP BY tils.id ORDER BY rank`).all(req.apiUser.id, `"${search.replace(/"/g, '""')}"`);
    } else if (searchtype === 'date') {
        const range = helpers.getDateRange(new Date(search).getTime());
        rows = sqldb.prepare(`${TIL_BASE_QUERY}
            WHERE tils.user_id = ? AND tils.date BETWEEN ? AND ? GROUP BY tils.id`).all(req.apiUser.id, range[0], range[1]);
    } else if (searchtype === 'tag') {
        rows = sqldb.prepare(`SELECT * FROM (
            ${TIL_BASE_QUERY}
            WHERE tils.user_id = ?
            GROUP BY tils.id
            ) WHERE tags LIKE ? OR tags LIKE ? OR tags LIKE ?`).all(req.apiUser.id, `${search}`, `%${search},%`, `%,${search}`);
    }

    const results = (rows || []).map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        date: row.date,
        repetitions: row.repetitions,
        tags: row.tags ? row.tags.split(',') : []
    }));

    res.json({ count: results.length, results: results });
});


// GET /api/v1/til/:id - Retrieve a single TIL
router.get('/til/:id', function (req, res) {
    const row = sqldb.prepare(`${TIL_BASE_QUERY}
        WHERE tils.user_id = ? AND tils.id = ?
        GROUP BY tils.id`).get(req.apiUser.id, req.params.id);

    if (!row) {
        return res.status(404).json({ error: 'TIL not found' });
    }

    res.json({
        id: row.id,
        title: row.title,
        description: row.description,
        date: row.date,
        repetitions: row.repetitions,
        tags: row.tags ? row.tags.split(',') : []
    });
});


// POST /api/v1/til - Create a new TIL
router.post('/til', function (req, res) {
    const { title, description, date } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: 'title and description are required' });
    }

    const tilDate = date ? new Date(date).getTime() : Date.now();

    let tags = parseHashtags(description);
    if (tags == null) {
        tags = ['#misc'];
    }

    const result = sqldb.prepare("INSERT INTO tils(user_id, title, description, date, repetitions) VALUES (?,?,?,?,?)")
        .run(req.apiUser.id, title, description, tilDate, 0);
    helpers.updateTags(result.lastInsertRowid, tags);

    res.status(201).json({
        id: Number(result.lastInsertRowid),
        title: title,
        description: description,
        date: tilDate,
        tags: tags
    });
});


// POST /api/v1/til/:id/image - Upload image to a TIL
router.post('/til/:id/image', upload.single('image'), function (req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No valid image file provided' });
  }

  const til = sqldb.prepare('SELECT id FROM tils WHERE id = ? AND user_id = ?').get(req.params.id, req.apiUser.id);
  if (!til) {
    return res.status(404).json({ error: 'TIL not found' });
  }

  const result = sqldb.prepare(
    'INSERT INTO til_images(til_id, image_data, mime_type, filename, created_at) VALUES (?,?,?,?,?)'
  ).run(req.params.id, req.file.buffer, req.file.mimetype, req.file.originalname, Date.now());

  const imageId = Number(result.lastInsertRowid);
  res.status(201).json({
    id: imageId,
    til_id: Number(req.params.id),
    filename: req.file.originalname,
    mime_type: req.file.mimetype,
    url: `/image/${imageId}`,
    markdown: `![${req.file.originalname}](/image/${imageId})`
  });
});


// GET /api/v1/til/:id/images - List images for a TIL
router.get('/til/:id/images', function (req, res) {
  const til = sqldb.prepare('SELECT id FROM tils WHERE id = ? AND user_id = ?').get(req.params.id, req.apiUser.id);
  if (!til) {
    return res.status(404).json({ error: 'TIL not found' });
  }

  const images = sqldb.prepare('SELECT id, filename, mime_type, created_at FROM til_images WHERE til_id = ?').all(req.params.id);
  res.json({
    til_id: Number(req.params.id),
    images: images.map(img => ({
      id: img.id,
      filename: img.filename,
      mime_type: img.mime_type,
      url: `/image/${img.id}`,
      created_at: img.created_at
    }))
  });
});


// DELETE /api/v1/til/:til_id/image/:image_id - Delete an image
router.delete('/til/:til_id/image/:image_id', function (req, res) {
  const til = sqldb.prepare('SELECT id FROM tils WHERE id = ? AND user_id = ?').get(req.params.til_id, req.apiUser.id);
  if (!til) {
    return res.status(404).json({ error: 'TIL not found' });
  }

  const result = sqldb.prepare('DELETE FROM til_images WHERE id = ? AND til_id = ?').run(req.params.image_id, req.params.til_id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Image not found' });
  }

  res.json({ success: true });
});


module.exports = router;
