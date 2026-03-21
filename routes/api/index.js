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
    const row = sqldb.prepare('SELECT id FROM tils WHERE title = ? AND user_id = ? LIMIT 1').get(req.params.title, req.user.id);
    res.json({ id: row ? row.id : false });
  });

module.exports = router;
