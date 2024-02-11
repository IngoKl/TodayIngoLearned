var express = require('express');
var sqldb = require('./../../db');
var router = express.Router();

var tilsObject = require('./../../helpers/tilsObject');

router.get('/:tag',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    // Since #s can't be used in URLs, we need to reintroduce them here
    request_tag = '#' + req.params.tag;

    sqldb.all(`SELECT * FROM (
                SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
                FROM tils 
                JOIN tags_join ON tags_join.til_id = tils.id 
                JOIN tags ON tags.id = tags_join.tag_id 
                WHERE tils.user_id = ?
                GROUP BY tils.id
              ) WHERE tags LIKE ? OR tags LIKE ? OR tags LIKE ?`, [req.user.id, request_tag, `%${request_tag},%`, `%,${request_tag}`], (err, rows) => {

      tils = tilsObject(rows);

      sqldb.get(`SELECT GROUP_CONCAT(tags) AS tags FROM (
        SELECT GROUP_CONCAT(tags.tag) AS tags 
        FROM tils 
        JOIN tags_join ON tags_join.til_id = tils.id 
        JOIN tags ON tags.id = tags_join.tag_id 
        WHERE tils.user_id = ?
        GROUP BY tils.id
        ) WHERE tags LIKE ?`, [req.user.id, `%${request_tag}%`], (err, row) => {

        // Going to a set and back to remove duplicates
        if (row.tags) {
          var related_tags = Array.from(new Set(row.tags.split(',')));

          res.render('tag', { tag: request_tag, tils_objects: tils[0], tils_keys: tils[1], related_tags: related_tags, user: req.user });
        } else {
          res.redirect('/');
        }

      });
    });
  });


module.exports = router;