const express = require('express');
const TilModel = require('./../../models/til');
const router = express.Router();
const tilsObject = require('./../../helpers/tilsObject');
const { TIL_BASE_QUERY } = require('./../../helpers/queries');
const sqldb = require('./../../db');

router.get('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      // TILs with #todo tag
      const todoRows = sqldb.prepare(`SELECT * FROM (
                  ${TIL_BASE_QUERY}
                  WHERE tils.user_id = ?
                  GROUP BY tils.id
                ) WHERE tags LIKE '#todo' OR tags LIKE '#todo,%' OR tags LIKE '%,#todo,%' OR tags LIKE '%,#todo'`).all(req.user.id);

      const todoTils = tilsObject(todoRows);

      // Empty TILs (no description or whitespace-only)
      const emptyRows = sqldb.prepare(`${TIL_BASE_QUERY}
                  WHERE tils.user_id = ? AND (tils.description IS NULL OR TRIM(tils.description) = '')
                  GROUP BY tils.id
                  ORDER BY tils.id DESC`).all(req.user.id);

      const emptyTils = tilsObject(emptyRows);

      res.render('todo', {
        todo_objects: todoTils[0], todo_keys: todoTils[1],
        empty_objects: emptyTils[0], empty_keys: emptyTils[1],
        user: req.user
      });
    } catch (err) { next(err); }
  });

module.exports = router;
