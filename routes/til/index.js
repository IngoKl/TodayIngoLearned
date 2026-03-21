const express = require('express');
const dayjs = require('dayjs');
const sqldb = require('./../../db');
const helpers = require('./../../helpers');
const parseHashtags = require('./../../helpers/parseHashtags');
const router = express.Router();

const tilsObject = require('./../../helpers/tilsObject');


router.get('/view/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags
              FROM tils JOIN tags_join ON tags_join.til_id = tils.id
              JOIN tags ON tags.id = tags_join.tag_id
              WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`).get(req.user.id, req.params.til_id);

    if (!row) {
      return res.status(404).send('TIL not found');
    }

    const tils = tilsObject([row]);
    const til = tils[0][tils[1][0]];
    til.public = row.public;

    // Find all urls in the description
    const til_urls = til.description.match(/\bhttps?:\/\/(\S(?<!\)))+/gi);

    const bookmark = sqldb.prepare("SELECT * FROM bookmarks WHERE til_id = ? AND user_id = ?").get(req.params.til_id, req.user.id);
    const bookmarked = !!bookmark;

    const comments = sqldb.prepare("SELECT * FROM til_comments WHERE til_id = ? AND user_id = ?").all(req.params.til_id, req.user.id);

    const related_tils = sqldb.prepare(`
      SELECT tils.id, tils.title, tils.date, GROUP_CONCAT(DISTINCT tags.tag) AS shared_tags,
             COUNT(DISTINCT shared_tj.tag_id) AS shared_count
      FROM tags_join AS shared_tj
      JOIN tags_join AS current_tj ON shared_tj.tag_id = current_tj.tag_id
      JOIN tils ON tils.id = shared_tj.til_id
      JOIN tags ON tags.id = shared_tj.tag_id
      WHERE current_tj.til_id = ?
        AND shared_tj.til_id != ?
        AND tils.user_id = ?
      GROUP BY tils.id
      ORDER BY shared_count DESC, tils.date DESC
      LIMIT 5
    `).all(req.params.til_id, req.params.til_id, req.user.id);

    res.render('view', { til: til, comments: comments, user: req.user, bookmarked: bookmarked, til_urls: til_urls, related_tils: related_tils });
  });


router.get('/view/:til_id/markdown',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags
              FROM tils JOIN tags_join ON tags_join.til_id = tils.id
              JOIN tags ON tags.id = tags_join.tag_id
              WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`).get(req.user.id, req.params.til_id);

    if (!row) {
      return res.status(404).send('TIL not found');
    }

    const tils = tilsObject([row]);
    const til = tils[0][tils[1][0]];

    const comments = sqldb.prepare("SELECT * FROM til_comments WHERE til_id = ? AND user_id = ?").all(req.params.til_id, req.user.id);

    res.setHeader('content-type', 'text/markdown');
    res.render('markdown', { til: til, comments: comments, user: req.user });
  });


router.get('/random',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT * FROM tils WHERE user_id = ? ORDER BY RANDOM() LIMIT 1").get(req.user.id);
    if (row) {
      res.redirect('/til/view/' + row.id);
    } else {
      res.redirect('/til/add');
    }
  });


router.get('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const title = req.query.title || false;
    res.render('add', { user: req.user, title: title, today: dayjs().format('YYYY-MM-DD') });
  });


router.post('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const title = req.body.title;
    const date = new Date(req.body.date).getTime();
    const description = req.body.description;

    let tags = parseHashtags(description);

    if (tags == null) {
      tags = ['#misc'];
    }

    const result = sqldb.prepare("INSERT INTO tils(user_id, title, description, date, repetitions) VALUES (?,?,?,?,?)").run(req.user.id, title, description, date, 0);
    helpers.updateTags(result.lastInsertRowid, tags);

    res.redirect(`/til/view/${result.lastInsertRowid}`);
  });


router.get('/edit/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT * FROM tils WHERE id = ? AND user_id = ?").get(req.params.til_id, req.user.id);
    if (!row) {
      return res.status(404).send('TIL not found');
    }
    res.render('edit', { til: row, date: dayjs(row.date).format('YYYY-MM-DD'), user: req.user });
  });


router.post('/edit/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const title = req.body.title;
    const date = new Date(req.body.date).getTime();
    const description = req.body.description;

    let tags = parseHashtags(description);

    if (tags == null) {
      tags = ['#misc'];
    }

    const isPublic = req.body.public ? 1 : 0;

    sqldb.prepare("UPDATE tils SET title = ?, date = ?, description = ?, public = ? WHERE id = ? AND user_id = ?").run(title, date, description, isPublic, req.params.til_id, req.user.id);
    helpers.updateTags(req.params.til_id, tags);

    res.redirect(`/til/view/${req.params.til_id}`);
  });


router.get('/edit/:til_id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.prepare("DELETE FROM tils WHERE id = ? AND user_id = ?").run(req.params.til_id, req.user.id);
    res.redirect('/');
  });


router.get('/edit/:til_id/bookmark',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT * FROM bookmarks WHERE til_id = ? AND user_id = ?").get(req.params.til_id, req.user.id);

    if (row) {
      // Bookmark exists, delete
      sqldb.prepare("DELETE FROM bookmarks WHERE til_id = ? AND user_id = ?").run(req.params.til_id, req.user.id);
    } else {
      // Bookmark doesn't exist, create
      sqldb.prepare("INSERT INTO bookmarks(user_id, til_id) VALUES (?,?)").run(req.user.id, req.params.til_id);
    }

    res.redirect('/til/view/' + req.params.til_id);
  });


router.get('/bookmarks',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags FROM tils
              JOIN tags_join ON tags_join.til_id = tils.id
              JOIN tags ON tags.id = tags_join.tag_id
              JOIN bookmarks ON bookmarks.til_id = tils.id
              WHERE bookmarks.user_id = ? GROUP BY tils.id`).all(req.user.id);

    const tils = tilsObject(rows);
    res.render('bookmarks', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
  });


router.get('/timeline',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const rows = sqldb.prepare(`
      SELECT tils.id, tils.title, tils.date,
             strftime('%Y-%m', datetime(date/1000, 'unixepoch')) as month
      FROM tils
      WHERE tils.user_id = ?
      ORDER BY tils.date DESC`).all(req.user.id);

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
  });


module.exports = router;
