const express = require('express');
const dayjs = require('dayjs');
const multer = require('multer');
const helpers = require('./../../helpers');
const parseHashtags = require('./../../helpers/parseHashtags');
const validate = require('./../../helpers/validate');
const dates = require('./../../helpers/dates');
const TilModel = require('./../../models/til');
const BookmarkModel = require('./../../models/bookmark');
const CommentModel = require('./../../models/comment');
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

const tilsObject = require('./../../helpers/tilsObject');


router.get('/view/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const row = TilModel.getById(req.user.id, req.params.til_id);

      if (!row) {
        return res.status(404).send('TIL not found');
      }

      const tils = tilsObject([row]);
      const til = tils[0][tils[1][0]];
      til.public = row.public;

      // Find all urls in the description (including www. without protocol)
      let til_urls = til.description ? til.description.match(/\b(?:https?:\/\/|www\.)(\S(?<!\)))+/gi) : null;
      if (til_urls) {
        til_urls = [...new Set(til_urls.map(url => url.match(/^https?:\/\//) ? url : 'https://' + url))];
      }

      const bookmarked = BookmarkModel.exists(req.user.id, req.params.til_id);
      const comments = CommentModel.listByTil(req.params.til_id, req.user.id);
      const til_images = ImageModel.listByTil(req.params.til_id);
      const related_tils = TilModel.getRelated(req.params.til_id, req.user.id);

      res.render('view', { til: til, comments: comments, user: req.user, bookmarked: bookmarked, til_urls: til_urls, related_tils: related_tils, til_images: til_images });
    } catch (err) { next(err); }
  });


router.get('/view/:til_id/markdown',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const row = TilModel.getById(req.user.id, req.params.til_id);

      if (!row) {
        return res.status(404).send('TIL not found');
      }

      const tils = tilsObject([row]);
      const til = tils[0][tils[1][0]];
      const comments = CommentModel.listByTil(req.params.til_id, req.user.id);

      res.setHeader('content-type', 'text/markdown');
      res.render('markdown', { til: til, comments: comments, user: req.user });
    } catch (err) { next(err); }
  });


router.get('/random',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const row = TilModel.getRandom(req.user.id);
      if (row) {
        res.redirect('/til/view/' + row.id);
      } else {
        res.redirect('/til/add');
      }
    } catch (err) { next(err); }
  });


router.get('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const title = req.query.title || false;
    res.render('add', { user: req.user, title: title, today: dayjs().format('YYYY-MM-DD') });
  });


router.post('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const check = validate.til(req.body);
      if (!check.valid) {
        return res.status(400).send(check.error);
      }

      const title = req.body.title;
      const date = dates.toMillis(req.body.date);
      const description = req.body.description;

      let tags = parseHashtags(description);
      if (tags == null) {
        tags = ['#misc'];
      }

      const result = TilModel.create(req.user.id, title, description, date);
      helpers.updateTags(result.lastInsertRowid, tags);
      TilModel.associateImages(result.lastInsertRowid, req.user.id, description);

      res.redirect(`/til/view/${result.lastInsertRowid}`);
    } catch (err) { next(err); }
  });


router.get('/edit/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const row = TilModel.getByIdRaw(req.user.id, req.params.til_id);
      if (!row) {
        return res.status(404).send('TIL not found');
      }
      res.render('edit', { til: row, date: dayjs(row.date).format('YYYY-MM-DD'), user: req.user });
    } catch (err) { next(err); }
  });


router.post('/edit/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const check = validate.til(req.body);
      if (!check.valid) {
        return res.status(400).send(check.error);
      }

      const title = req.body.title;
      const date = dates.toMillis(req.body.date);
      const description = req.body.description;

      let tags = parseHashtags(description);
      if (tags == null) {
        tags = ['#misc'];
      }

      const isPublic = req.body.public ? 1 : 0;

      TilModel.update(req.user.id, req.params.til_id, title, date, description, isPublic);
      helpers.updateTags(req.params.til_id, tags);
      TilModel.associateImages(req.params.til_id, req.user.id, description);

      res.redirect(`/til/view/${req.params.til_id}`);
    } catch (err) { next(err); }
  });


router.post('/edit/:til_id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const deleted = TilModel.deleteWithRelated(req.user.id, req.params.til_id);
      if (!deleted) return res.status(404).send('TIL not found');
      res.redirect('/');
    } catch (err) { next(err); }
  });


router.post('/edit/:til_id/bookmark',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      BookmarkModel.toggle(req.user.id, req.params.til_id);
      res.redirect('/til/view/' + req.params.til_id);
    } catch (err) { next(err); }
  });


router.get('/bookmarks',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const rows = BookmarkModel.listAll(req.user.id);
      const tils = tilsObject(rows);
      res.render('bookmarks', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
    } catch (err) { next(err); }
  });


router.get('/timeline',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const rows = TilModel.getTimeline(req.user.id);

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
    } catch (err) { next(err); }
  });


// Upload image (AJAX endpoint)
router.post('/upload-image',
  require('connect-ensure-login').ensureLoggedIn(),
  upload.single('image'),
  function (req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No valid image file provided' });
      }

      const tilId = req.body.til_id || null;
      if (tilId && !TilModel.getIdOnly(req.user.id, tilId)) {
        return res.status(404).json({ error: 'TIL not found' });
      }

      const result = ImageModel.create(req.user.id, tilId, req.file.buffer, req.file.mimetype, req.file.originalname);

      const imageId = Number(result.lastInsertRowid);
      res.json({
        id: imageId,
        markdown: `![${req.file.originalname}](/image/${imageId})`,
        filename: req.file.originalname
      });
    } catch (err) { next(err); }
  }
);


// Delete individual image
router.post('/delete-image/:image_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const image = ImageModel.getOwned(req.params.image_id, req.user.id);

      if (!image) {
        return res.status(404).json({ error: 'Image not found' });
      }

      ImageModel.deleteOwned(req.params.image_id, req.user.id);

      if (req.accepts('json')) {
        return res.json({ success: true });
      }
      if (image.til_id) {
        return res.redirect('/til/edit/' + image.til_id);
      }
      res.redirect('/');
    } catch (err) { next(err); }
  }
);


module.exports = router;
