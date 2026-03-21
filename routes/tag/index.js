const express = require('express');
const helpers = require('./../../helpers');
const sqldb = require('./../../db');
const router = express.Router();

const tilsObject = require('./../../helpers/tilsObject');

function escapeLike(str) {
  return str.replace(/[%_]/g, '\\$&');
}

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
    const escaped_tag = escapeLike(request_tag);

    const rows = sqldb.prepare(`SELECT * FROM (
                SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags
                FROM tils
                JOIN tags_join ON tags_join.til_id = tils.id
                JOIN tags ON tags.id = tags_join.tag_id
                WHERE tils.user_id = ?
                GROUP BY tils.id
              ) WHERE tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\'`).all(req.user.id, escaped_tag, `%${escaped_tag},%`, `%,${escaped_tag}`);

    const tils = tilsObject(rows);

    const tagRow = sqldb.prepare(`SELECT GROUP_CONCAT(tags) AS tags FROM (
        SELECT GROUP_CONCAT(tags.tag) AS tags
        FROM tils
        JOIN tags_join ON tags_join.til_id = tils.id
        JOIN tags ON tags.id = tags_join.tag_id
        WHERE tils.user_id = ?
        GROUP BY tils.id
        ) WHERE tags LIKE ? ESCAPE '\\'`).get(req.user.id, `%${escaped_tag}%`);

    // Going to a set and back to remove duplicates
    if (tagRow.tags) {
      const related_tags = Array.from(new Set(tagRow.tags.split(',')));
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const perPage = 10;
      const totalPages = Math.ceil(tils[1].length / perPage);
      const pagedKeys = tils[1].slice((page - 1) * perPage, page * perPage);
      res.render('tag', { tag: request_tag, tils_objects: tils[0], tils_keys: pagedKeys, related_tags: related_tags, user: req.user, page: page, totalPages: totalPages });
    } else {
      res.redirect('/');
    }
  });


module.exports = router;
