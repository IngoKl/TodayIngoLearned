const express = require('express');
const dayjs = require('dayjs');
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

const tilsObject = require('./../../helpers/tilsObject');


router.get('/view/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare(`${TIL_BASE_QUERY}
              WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`).get(req.user.id, req.params.til_id);

    if (!row) {
      return res.status(404).send('TIL not found');
    }

    const tils = tilsObject([row]);
    const til = tils[0][tils[1][0]];
    til.public = row.public;

    // Find all urls in the description (including www. without protocol)
    let til_urls = til.description.match(/\b(?:https?:\/\/|www\.)(\S(?<!\)))+/gi);
    if (til_urls) {
      til_urls = [...new Set(til_urls.map(url => url.match(/^https?:\/\//) ? url : 'https://' + url))];
    }

    const bookmark = sqldb.prepare("SELECT * FROM bookmarks WHERE til_id = ? AND user_id = ?").get(req.params.til_id, req.user.id);
    const bookmarked = !!bookmark;

    const comments = sqldb.prepare("SELECT * FROM til_comments WHERE til_id = ? AND user_id = ?").all(req.params.til_id, req.user.id);

    const til_images = sqldb.prepare('SELECT id, filename, mime_type FROM til_images WHERE til_id = ?').all(req.params.til_id);

    const related_tils = sqldb.prepare(`
      SELECT tils.id, tils.title, tils.date, GROUP_CONCAT(DISTINCT tags.tag) AS shared_tags,
             COUNT(DISTINCT shared_tj.tag_id) AS shared_count
      FROM tags_join AS shared_tj
      JOIN tags_join AS current_tj ON shared_tj.tag_id = current_tj.tag_id
      JOIN tils ON tils.id = shared_tj.til_id
      JOIN tags ON tags.id = shared_tj.tag_id
      WHERE current_tj.til_id = ?
        AND shared_tj.til_id != ?
        AND tils.user_id = ?
      GROUP BY tils.id
      ORDER BY shared_count DESC, tils.date DESC
      LIMIT 5
    `).all(req.params.til_id, req.params.til_id, req.user.id);

    res.render('view', { til: til, comments: comments, user: req.user, bookmarked: bookmarked, til_urls: til_urls, related_tils: related_tils, til_images: til_images });
  });


router.get('/view/:til_id/markdown',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare(`${TIL_BASE_QUERY}
              WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`).get(req.user.id, req.params.til_id);

    if (!row) {
      return res.status(404).send('TIL not found');
    }

    const tils = tilsObject([row]);
    const til = tils[0][tils[1][0]];

    const comments = sqldb.prepare("SELECT * FROM til_comments WHERE til_id = ? AND user_id = ?").all(req.params.til_id, req.user.id);

    res.setHeader('content-type', 'text/markdown');
    res.render('markdown', { til: til, comments: comments, user: req.user });
  });


router.get('/random',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT * FROM tils WHERE user_id = ? ORDER BY RANDOM() LIMIT 1").get(req.user.id);
    if (row) {
      res.redirect('/til/view/' + row.id);
    } else {
      res.redirect('/til/add');
    }
  });


router.get('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const title = req.query.title || false;
    res.render('add', { user: req.user, title: title, today: dayjs().format('YYYY-MM-DD') });
  });


router.post('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const title = req.body.title;
    const date = new Date(req.body.date).getTime();
    const description = req.body.description;

    let tags = parseHashtags(description);

    if (tags == null) {
      tags = ['#misc'];
    }

    const result = sqldb.prepare("INSERT INTO tils(user_id, title, description, date, repetitions) VALUES (?,?,?,?,?)").run(req.user.id, title, description, date, 0);
    helpers.updateTags(result.lastInsertRowid, tags);

    // Associate any images referenced in the description
    const imageRefs = description.match(/!\[.*?\]\(\/image\/(\d+)\)/g);
    if (imageRefs) {
      const imageIds = imageRefs.map(ref => ref.match(/\/image\/(\d+)/)[1]);
      const associateStmt = sqldb.prepare('UPDATE til_images SET til_id = ? WHERE id = ? AND til_id IS NULL');
      for (const imgId of imageIds) {
        associateStmt.run(result.lastInsertRowid, imgId);
      }
    }

    res.redirect(`/til/view/${result.lastInsertRowid}`);
  });


router.get('/edit/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT * FROM tils WHERE id = ? AND user_id = ?").get(req.params.til_id, req.user.id);
    if (!row) {
      return res.status(404).send('TIL not found');
    }
    res.render('edit', { til: row, date: dayjs(row.date).format('YYYY-MM-DD'), user: req.user });
  });


router.post('/edit/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const title = req.body.title;
    const date = new Date(req.body.date).getTime();
    const description = req.body.description;

    let tags = parseHashtags(description);

    if (tags == null) {
      tags = ['#misc'];
    }

    const isPublic = req.body.public ? 1 : 0;

    sqldb.prepare("UPDATE tils SET title = ?, date = ?, description = ?, public = ? WHERE id = ? AND user_id = ?").run(title, date, description, isPublic, req.params.til_id, req.user.id);
    helpers.updateTags(req.params.til_id, tags);

    // Associate any new images referenced in the description
    const imageRefs = description.match(/!\[.*?\]\(\/image\/(\d+)\)/g);
    if (imageRefs) {
      const imageIds = imageRefs.map(ref => ref.match(/\/image\/(\d+)/)[1]);
      const associateStmt = sqldb.prepare('UPDATE til_images SET til_id = ? WHERE id = ? AND til_id IS NULL');
      for (const imgId of imageIds) {
        associateStmt.run(req.params.til_id, imgId);
      }
    }

    res.redirect(`/til/view/${req.params.til_id}`);
  });


router.get('/edit/:til_id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const til = sqldb.prepare("SELECT id FROM tils WHERE id = ? AND user_id = ?").get(req.params.til_id, req.user.id);
    if (!til) return res.status(404).send('TIL not found');

    sqldb.prepare("DELETE FROM tags_join WHERE til_id = ?").run(req.params.til_id);
    sqldb.prepare("DELETE FROM bookmarks WHERE til_id = ?").run(req.params.til_id);
    sqldb.prepare("DELETE FROM til_comments WHERE til_id = ?").run(req.params.til_id);
    sqldb.prepare("DELETE FROM til_images WHERE til_id = ?").run(req.params.til_id);
    sqldb.prepare("DELETE FROM tils WHERE id = ?").run(req.params.til_id);
    res.redirect('/');
  });


router.get('/edit/:til_id/bookmark',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT * FROM bookmarks WHERE til_id = ? AND user_id = ?").get(req.params.til_id, req.user.id);

    if (row) {
      // Bookmark exists, delete
      sqldb.prepare("DELETE FROM bookmarks WHERE til_id = ? AND user_id = ?").run(req.params.til_id, req.user.id);
    } else {
      // Bookmark doesn't exist, create
      sqldb.prepare("INSERT INTO bookmarks(user_id, til_id) VALUES (?,?)").run(req.user.id, req.params.til_id);
    }

    res.redirect('/til/view/' + req.params.til_id);
  });


router.get('/bookmarks',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const rows = sqldb.prepare(`${TIL_BASE_QUERY}
              JOIN bookmarks ON bookmarks.til_id = tils.id
              WHERE bookmarks.user_id = ? GROUP BY tils.id`).all(req.user.id);

    const tils = tilsObject(rows);
    res.render('bookmarks', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
  });


router.get('/timeline',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const rows = sqldb.prepare(`
      SELECT tils.id, tils.title, tils.date,
             strftime('%Y-%m', datetime(date/1000, 'unixepoch')) as month
      FROM tils
      WHERE tils.user_id = ?
      ORDER BY tils.date DESC`).all(req.user.id);

    // Group TILs by month
    const tilsByMonth = {};
    rows.forEach(row => {
      if (!tilsByMonth[row.month]) {
        tilsByMonth[row.month] = [];
      }
      tilsByMonth[row.month].push(row);
    });

    res.render('timeline', {
      tilsByMonth: tilsByMonth,
      user: req.user,
      dayjs: dayjs
    });
  });


// Upload image (AJAX endpoint)
router.post('/upload-image',
  require('connect-ensure-login').ensureLoggedIn(),
  upload.single('image'),
  function (req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'No valid image file provided' });
    }

    const tilId = req.body.til_id || null;
    const result = sqldb.prepare(
      'INSERT INTO til_images(til_id, image_data, mime_type, filename, created_at) VALUES (?,?,?,?,?)'
    ).run(tilId, req.file.buffer, req.file.mimetype, req.file.originalname, Date.now());

    const imageId = Number(result.lastInsertRowid);
    res.json({
      id: imageId,
      markdown: `![${req.file.originalname}](/image/${imageId})`,
      filename: req.file.originalname
    });
  }
);


// Delete individual image
router.get('/delete-image/:image_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const image = sqldb.prepare(`
      SELECT til_images.id, til_images.til_id
      FROM til_images
      LEFT JOIN tils ON tils.id = til_images.til_id
      WHERE til_images.id = ? AND (tils.user_id = ? OR til_images.til_id IS NULL)
    `).get(req.params.image_id, req.user.id);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    sqldb.prepare('DELETE FROM til_images WHERE id = ?').run(req.params.image_id);

    if (req.accepts('json')) {
      return res.json({ success: true });
    }
    if (image.til_id) {
      return res.redirect('/til/edit/' + image.til_id);
    }
    res.redirect('/');
  }
);


module.exports = router;
