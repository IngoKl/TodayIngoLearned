const express = require('express');
const sqldb = require('./../../db');
const router = express.Router();

const tilsObject = require('./../../helpers/tilsObject');

router.get('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    // TILs with #todo tag
    const todoRows = sqldb.prepare(`SELECT * FROM (
                SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
                FROM tils
                JOIN tags_join ON tags_join.til_id = tils.id
                JOIN tags ON tags.id = tags_join.tag_id
                WHERE tils.user_id = ?
                GROUP BY tils.id
              ) WHERE tags LIKE '#todo' OR tags LIKE '%#todo,%' OR tags LIKE '%,#todo'`).all(req.user.id);

    const todoTils = tilsObject(todoRows);

    // Empty TILs (no description or whitespace-only)
    const emptyRows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
                FROM tils
                JOIN tags_join ON tags_join.til_id = tils.id
                JOIN tags ON tags.id = tags_join.tag_id
                WHERE tils.user_id = ? AND (tils.description IS NULL OR TRIM(tils.description) = '')
                GROUP BY tils.id
                ORDER BY tils.id DESC`).all(req.user.id);

    const emptyTils = tilsObject(emptyRows);

    res.render('todo', {
      todo_objects: todoTils[0], todo_keys: todoTils[1],
      empty_objects: emptyTils[0], empty_keys: emptyTils[1],
      user: req.user
    });
  });

module.exports = router;
