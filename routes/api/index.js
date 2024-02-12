var express = require('express');
var sqldb = require('./../../db');
var helpers = require('./../../helpers');
var router = express.Router();

// A JSON endpoint exposing tags so that they can be used in search
router.get('/tags',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
      var tags = helpers.getUserTags(req.user.id, function(tags) {
      tags = [...new Set(tags)];

      res.json({
        tags
      });
    });
  });

// JSON endpoint for linking between TILs
router.get('/findid/:title',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    sqldb.all(`SELECT * FROM tils WHERE title == ? AND user_id == ? LIMIT 1`, [req.params.title, req.user.id], (err, rows) => {
      if (err) {
        res.status(400).json({ "error": err.message });
        return;
      }

      var id = false;
      rows.forEach(function (row) {
        id = row.id;
      });

      res.json({
        id
      });
    });
  });

module.exports = router;