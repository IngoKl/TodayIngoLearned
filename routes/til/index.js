var express = require('express');
var moment = require('moment');
var sqldb = require('./../../db');
var helpers = require('./../../helpers');
var parseHashtags = require('./../../helpers/parseHashtags');
var router = express.Router();

var tilsObject = require('./../../helpers/tilsObject');


router.get('/view/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;
    var bookmarked = false;

    sqldb.get(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
              FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
              JOIN tags ON tags.id = tags_join.tag_id 
              WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`, [req.user.id, req.params.til_id], (err, row) => {

      tils = tilsObject([row]);

      til = tils[0][tils[1][0]];

      // Find all urls in the description
      til_urls = til.description.match(/\bhttps?:\/\/(\S(?<!\)))+/gi);

      sqldb.get("SELECT * FROM bookmarks WHERE til_id = ? AND user_id = ?", [req.params.til_id, req.user.id], (err, row) => {
        if (row) {
          bookmarked = true;
        }

        sqldb.all("SELECT * FROM til_comments WHERE til_id = ? and user_id = ?", [req.params.til_id, req.user.id], (err, rows) => {
          comments = rows;

          res.render('view', { til: til, comments: comments, user: req.user, bookmarked: bookmarked, til_urls: til_urls });
        });

      });

    });
  });


router.get('/view/:til_id/markdown',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;

    sqldb.get(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
              FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
              JOIN tags ON tags.id = tags_join.tag_id 
              WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`, [req.user.id, req.params.til_id], (err, row) => {

      tils = tilsObject([row]);

      til = tils[0][tils[1][0]];

      sqldb.all("SELECT * FROM til_comments WHERE til_id = ? and user_id = ?", [req.params.til_id, req.user.id], (err, rows) => {
        comments = rows;

        res.setHeader('content-type', 'text/markdown');
        res.render('markdown', { til: til, comments: comments, user: req.user});
      });

      });
    
    });


router.get('/random',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    sqldb.get("SELECT * FROM tils WHERE user_id = ? ORDER BY RANDOM() LIMIT 1", req.user.id, (err, row) => {
      if (row) {
        res.redirect('/til/view/' + row.id);
      } else {
        res.redirect('/til/add');
      }
    });

  });


router.get('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    var title = false;
    if (req.query.title) {
      title = req.query.title;
    }

    res.render('add', { user: req.user, title: title, today: moment().format('YYYY-MM-DD') });
  });


router.post('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    var title = req.body.title;
    var date = new Date(req.body.date).getTime();
    var description = req.body.description;

    var tags = parseHashtags(description);

    if (tags == null) {
      tags = ['#misc'];
    }

    sqldb.run("INSERT INTO tils(user_id, title, description, date, repetitions) VALUES (?,?,?,?,?)", [req.user.id, title, description, date, 0], function (err) {
      helpers.updateTags(this.lastID, tags);

      res.redirect(`/til/view/${this.lastID}`);
    });

  });


router.get('/edit/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.get("SELECT * FROM tils WHERE id = ? and user_id = ?", [req.params.til_id, req.user.id], (err, row) => {

      res.render('edit', { til: row, date: moment(row.date).format('YYYY-MM-DD'), user: req.user });
    });
  });


router.post('/edit/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    var title = req.body.title;
    var date = new Date(req.body.date).getTime();
    var description = req.body.description;

    tags = parseHashtags(description);

    if (tags == null) {
      tags = ['#misc'];
    }

    sqldb.run("UPDATE tils SET title = ?, date = ?, description = ? WHERE id = ? AND user_id = ?", [title, date, description, req.params.til_id, req.user.id], function (err) {
      helpers.updateTags(req.params.til_id, tags);

      res.redirect(`/til/view/${req.params.til_id}`);
    });

  });


router.get('/edit/:til_id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.run("DELETE FROM tils WHERE id = ? AND user_id = ?", [req.params.til_id, req.user.id]);
    res.redirect('/');
  });


router.get('/edit/:til_id/bookmark',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.get("SELECT * FROM bookmarks WHERE til_id = ? and user_id = ?", [req.params.til_id, req.user.id], (err, row) => {

      if (row) {
        // Bookmark exists, delete
        sqldb.run("DELETE FROM bookmarks WHERE til_id = ? and user_id = ?", [req.params.til_id, req.user.id]);
        res.redirect('/til/view/' + req.params.til_id);

      } else {
        // Bookmark doesn't exist, create
        sqldb.run("INSERT INTO bookmarks(user_id, til_id) VALUES (?,?)", [req.user.id, req.params.til_id]);
        res.redirect('/til/view/' + req.params.til_id);
      }

    });
  });


router.get('/bookmarks',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;

    sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags FROM tils 
              JOIN tags_join ON tags_join.til_id = tils.id 
              JOIN tags ON tags.id = tags_join.tag_id
              JOIN bookmarks ON bookmarks.til_id = tils.id
              WHERE bookmarks.user_id = ? GROUP BY tils.id`, [req.user.id], (err, rows) => {

      tils = tilsObject(rows);
      res.render('bookmarks', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
    });
  });


router.get('/timeline',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.all(`
      SELECT tils.id, tils.title, tils.date,
             strftime('%Y-%m', datetime(date/1000, 'unixepoch')) as month
      FROM tils 
      WHERE tils.user_id = ? 
      ORDER BY tils.date DESC`, 
      [req.user.id], 
      (err, rows) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Database error');
        }

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
          moment: moment
        });
    });
  });


module.exports = router;