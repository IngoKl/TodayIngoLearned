const express = require('express');
const TagModel = require('./../../models/tag');
const ImageModel = require('./../../models/image');
const router = express.Router();
const sqldb = require('./../../db');

// A JSON endpoint exposing tags so that they can be used in search
router.get('/tags',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const tags = TagModel.getUserTags(req.user.id);
      res.json({ tags });
    } catch (err) { next(err); }
  });

// JSON endpoint for linking between TILs
router.get('/findid/:title',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const row = sqldb.prepare('SELECT id FROM tils WHERE title = ? COLLATE NOCASE AND user_id = ? LIMIT 1').get(req.params.title, req.user.id);
      res.json({ id: row ? row.id : false });
    } catch (err) { next(err); }
  });

// JSON endpoint exposing all TIL titles for auto-linking
router.get('/titles',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const rows = sqldb.prepare('SELECT id, title FROM tils WHERE user_id = ?').all(req.user.id);
      res.json({ titles: rows });
    } catch (err) { next(err); }
  });

// JSON endpoint for knowledge graph data
router.get('/graph',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const data = TagModel.getGraphData(req.user.id);
      res.json(data);
    } catch (err) { next(err); }
  });

// JSON endpoint for fetching TIL images
router.get('/images/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const images = ImageModel.listByTil(req.params.til_id);
      res.json({ images });
    } catch (err) { next(err); }
  });

module.exports = router;
