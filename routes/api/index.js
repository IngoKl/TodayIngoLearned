const express = require('express');
const sqldb = require('./../../db');
const helpers = require('./../../helpers');
const router = express.Router();

// A JSON endpoint exposing tags so that they can be used in search
router.get('/tags',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const tags = [...new Set(helpers.getUserTags(req.user.id))];
    res.json({ tags });
  });

// JSON endpoint for linking between TILs
router.get('/findid/:title',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare('SELECT id FROM tils WHERE title = ? COLLATE NOCASE AND user_id = ? LIMIT 1').get(req.params.title, req.user.id);
    res.json({ id: row ? row.id : false });
  });

// JSON endpoint exposing all TIL titles for auto-linking
router.get('/titles',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const rows = sqldb.prepare('SELECT id, title FROM tils WHERE user_id = ?').all(req.user.id);
    res.json({ titles: rows });
  });

// JSON endpoint for knowledge graph data
router.get('/graph',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const nodes = sqldb.prepare(`
      SELECT tags.id, tags.tag, COUNT(DISTINCT tags_join.til_id) AS count
      FROM tags
      JOIN tags_join ON tags.id = tags_join.tag_id
      JOIN tils ON tils.id = tags_join.til_id
      WHERE tils.user_id = ?
      GROUP BY tags.id
    `).all(req.user.id);

    const edges = sqldb.prepare(`
      SELECT t1.tag_id AS source, t2.tag_id AS target,
             COUNT(DISTINCT t1.til_id) AS weight
      FROM tags_join t1
      JOIN tags_join t2 ON t1.til_id = t2.til_id AND t1.tag_id < t2.tag_id
      JOIN tils ON tils.id = t1.til_id
      WHERE tils.user_id = ?
      GROUP BY t1.tag_id, t2.tag_id
    `).all(req.user.id);

    res.json({ nodes: nodes, edges: edges });
  });

// JSON endpoint for fetching TIL images
router.get('/images/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const images = sqldb.prepare(
      'SELECT id, filename, mime_type FROM til_images WHERE til_id = ?'
    ).all(req.params.til_id);
    res.json({ images });
  });

module.exports = router;
