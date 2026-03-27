const express = require('express');
const multer = require('multer');
const helpers = require('./../../helpers');
const parseHashtags = require('./../../helpers/parseHashtags');
const validate = require('./../../helpers/validate');
const dates = require('./../../helpers/dates');
const TilModel = require('./../../models/til');
const ImageModel = require('./../../models/image');
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
router.get('/til/search', function (req, res, next) {
    try {
        const searchtype = req.query.type;
        const search = req.query.q;

        if (!searchtype || !search) {
            return res.status(400).json({ error: 'type and q query parameters are required' });
        }

        if (!validate.searchType(searchtype)) {
            return res.status(400).json({ error: 'type must be one of: title, text, tag, date' });
        }

        let rows;

        if (searchtype === 'title') {
            rows = TilModel.searchByTitle(req.apiUser.id, search);
        } else if (searchtype === 'text') {
            rows = TilModel.searchByText(req.apiUser.id, search);
        } else if (searchtype === 'date') {
            const range = dates.dayRangeMillis(dates.toMillis(search));
            rows = TilModel.searchByDate(req.apiUser.id, range[0], range[1]);
        } else if (searchtype === 'tag') {
            rows = TilModel.searchByTag(req.apiUser.id, search);
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
    } catch (err) { next(err); }
});


// GET /api/v1/til/:id - Retrieve a single TIL
router.get('/til/:id', function (req, res, next) {
    try {
        const row = TilModel.getById(req.apiUser.id, req.params.id);

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
    } catch (err) { next(err); }
});


// POST /api/v1/til - Create a new TIL
router.post('/til', function (req, res, next) {
    try {
        const { title, description, date } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: 'title and description are required' });
        }

        const tilDate = date ? dates.toMillis(date) : dates.nowMillis();

        let tags = parseHashtags(description);
        if (tags == null) {
            tags = ['#misc'];
        }

        const result = TilModel.create(req.apiUser.id, title, description, tilDate);
        helpers.updateTags(result.lastInsertRowid, tags);

        res.status(201).json({
            id: Number(result.lastInsertRowid),
            title: title,
            description: description,
            date: tilDate,
            tags: tags
        });
    } catch (err) { next(err); }
});


// POST /api/v1/til/:id/image - Upload image to a TIL
router.post('/til/:id/image', upload.single('image'), function (req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No valid image file provided' });
    }

    const til = TilModel.getIdOnly(req.apiUser.id, req.params.id);
    if (!til) {
      return res.status(404).json({ error: 'TIL not found' });
    }

    const result = ImageModel.create(req.apiUser.id, req.params.id, req.file.buffer, req.file.mimetype, req.file.originalname);

    const imageId = Number(result.lastInsertRowid);
    res.status(201).json({
      id: imageId,
      til_id: Number(req.params.id),
      filename: req.file.originalname,
      mime_type: req.file.mimetype,
      url: `/image/${imageId}`,
      markdown: `![${req.file.originalname}](/image/${imageId})`
    });
  } catch (err) { next(err); }
});


// GET /api/v1/til/:id/images - List images for a TIL
router.get('/til/:id/images', function (req, res, next) {
  try {
    const til = TilModel.getIdOnly(req.apiUser.id, req.params.id);
    if (!til) {
      return res.status(404).json({ error: 'TIL not found' });
    }

    const images = ImageModel.listByTilDetailed(req.params.id);
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
  } catch (err) { next(err); }
});


// DELETE /api/v1/til/:til_id/image/:image_id - Delete an image
router.delete('/til/:til_id/image/:image_id', function (req, res, next) {
  try {
    const til = TilModel.getIdOnly(req.apiUser.id, req.params.til_id);
    if (!til) {
      return res.status(404).json({ error: 'TIL not found' });
    }

    const result = ImageModel.deleteByIdAndTil(req.params.image_id, req.params.til_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});


module.exports = router;
