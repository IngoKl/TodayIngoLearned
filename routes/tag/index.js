const express = require('express');
const helpers = require('./../../helpers');
const sqldb = require('./../../db');
const router = express.Router();

const tilsObject = require('./../../helpers/tilsObject');

// Rendering tags and showing all tags a user has used
router.get('/tags',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const tags = [...new Set(helpers.getUserTags(req.user.id))].sort();
    res.render('tags', { tags: tags });
  });

router.get('/:tag',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    // Since #s can't be used in URLs, we need to reintroduce them here
    const request_tag = '#' + req.params.tag;

    const rows = sqldb.prepare(`SELECT * FROM (
                SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
                FROM tils
                JOIN tags_join ON tags_join.til_id = tils.id
                JOIN tags ON tags.id = tags_join.tag_id
                WHERE tils.user_id = ?
                GROUP BY tils.id
              ) WHERE tags LIKE ? OR tags LIKE ? OR tags LIKE ?`).all(req.user.id, request_tag, `%${request_tag},%`, `%,${request_tag}`);

    const tils = tilsObject(rows);

    const tagRow = sqldb.prepare(`SELECT GROUP_CONCAT(tags) AS tags FROM (
        SELECT GROUP_CONCAT(tags.tag) AS tags
        FROM tils
        JOIN tags_join ON tags_join.til_id = tils.id
        JOIN tags ON tags.id = tags_join.tag_id
        WHERE tils.user_id = ?
        GROUP BY tils.id
        ) WHERE tags LIKE ?`).get(req.user.id, `%${request_tag}%`);

    // Going to a set and back to remove duplicates
    if (tagRow.tags) {
      const related_tags = Array.from(new Set(tagRow.tags.split(',')));
      res.render('tag', { tag: request_tag, tils_objects: tils[0], tils_keys: tils[1], related_tags: related_tags, user: req.user });
    } else {
      res.redirect('/');
    }
  });


module.exports = router;
