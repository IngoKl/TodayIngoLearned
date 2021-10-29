var parseHashtags = require('parse-hashtags');
var moment = require('moment');
var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var db = require('./db');
var helpers = require('./helpers');

var config = require('./config.json');

const sqlite3 = require('sqlite3').verbose();
var sqldb = new sqlite3.Database(config.dbpath);

// Passport for authentication
passport.use(new LocalStrategy(function (username, password, cb) {
  sqldb.get("SELECT username, id FROM users WHERE username = ? AND password = ?", username, helpers.hashPassword(password), function (err, row) {
    if (!row) return cb(null, false);
    return cb(null, row);
  });
}));

passport.serializeUser(function (user, cb) {
  return cb(null, user.id);
});

passport.deserializeUser(function (id, done) {
  sqldb.get("SELECT id, username FROM users WHERE id = ?", id, function (err, row) {
    if (!row) return done(null, false);
    return done(null, row);
  });
});

// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Trust the proxy
app.set('trust proxy', 1)

// Make all necessary node_module files available
app.use('/static/js', express.static(__dirname + '/node_modules/bootstrap/dist/js'));
app.use('/static/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));
app.use('/static/js', express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/static/js', express.static(__dirname + '/node_modules/popper.js/dist'));
app.use('/static/js', express.static(__dirname + '/node_modules/showdown/dist'));
app.use('/static/js', express.static(__dirname + '/node_modules/js-autocomplete'));
app.use('/static/css', express.static(__dirname + '/node_modules/js-autocomplete'));

// Make assets available
app.use('/static', express.static('static'));
app.use('/', express.static('public'));

// Middleware
app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ 
  secret: config.expresssessionsecret, 
  resave: false, 
  saveUninitialized: false,
  // set secure to true if possible (i.e., when using HTTPS)
  cookie: {secure: config.securecoockies, maxAge: 7776000000}
}));

// Initialize Passport and restore authentication state from the session.
app.use(passport.initialize());
app.use(passport.session());

// Create an object to be used in a template from SQL rows
function tils_object(tils) {
  tils_combined = Object();

  tils.forEach(element => {
    tils_combined[element.title] = Object();
    tils_combined[element.title]["til_id"] = element.id;
    tils_combined[element.title]["title"] = element.title;
    tils_combined[element.title]["date"] = new Date(element.date);
    tils_combined[element.title]["repetitions"] = element.repetitions;
    tils_combined[element.title]["last_repetition"] = new Date(element.last_repetition);
    tils_combined[element.title]["description"] = element.description;
    tils_combined[element.title]["tags"] = element.tags.split(',');
  });

  tils_keys = [];
  for (key in tils_combined) {
    tils_keys.push(tils_combined[key]["title"]);
  }

  return [tils_combined, tils_keys];
}


// Get the start/end timestamp of a given day
function get_day_range(timestamp) {
  start_date = moment(timestamp).startOf('day').valueOf();
  end_date = moment(timestamp).endOf('day').valueOf();

  return [start_date, end_date];
}

// Define routes
app.get('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;

    sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
    FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
    JOIN tags ON tags.id = tags_join.tag_id 
    WHERE tils.user_id = ? GROUP BY tils.id ORDER BY tils.id DESC LIMIT 10`, [req.user.id], (err, rows) => {

      tils = tils_object(rows);
      res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
    });
  });


app.post('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var searchtype = req.body.searchtype;
    var search = req.body.search;

    if (searchtype == 'title') {
      var tils = null;
      sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
      JOIN tags ON tags.id = tags_join.tag_id 
      WHERE tils.user_id = ? AND tils.title LIKE ? GROUP BY tils.id`, [req.user.id, `%${search}%`], (err, rows) => {

        tils = tils_object(rows);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
      });

    }
    if (searchtype == 'text') {
      var tils = null;
      sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
      JOIN tags ON tags.id = tags_join.tag_id 
      WHERE tils.user_id = ? AND tils.description LIKE ? GROUP BY tils.id`, [req.user.id, `%${search}%`], (err, rows) => {

        tils = tils_object(rows);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
      });

    }
    else if (searchtype == 'date') {
      var range = get_day_range(new Date(search).getTime());

      var tils = null;
      sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
      JOIN tags ON tags.id = tags_join.tag_id 
      WHERE tils.user_id = ? and tils.date BETWEEN ? AND ? GROUP BY tils.id`, [req.user.id, range[0], range[1]], (err, rows) => {
        
        tils = tils_object(rows);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
      });

    }
    else if (searchtype == 'tag') {
      var tils = null;
      sqldb.all(`SELECT * FROM (
                  SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
                  FROM tils 
                  JOIN tags_join ON tags_join.til_id = tils.id 
                  JOIN tags ON tags.id = tags_join.tag_id 
                  WHERE tils.user_id = ?
                  GROUP BY tils.id
                ) WHERE tags LIKE ? OR tags LIKE ? OR tags LIKE ?`, [req.user.id, `${search}`, `%${search},%`, `%,${search}`], (err, rows) => {

        tils = tils_object(rows);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
      });

    }
  });


app.get('/bookmarks',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;

    sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags FROM tils 
              JOIN tags_join ON tags_join.til_id = tils.id 
              JOIN tags ON tags.id = tags_join.tag_id
              JOIN bookmarks ON bookmarks.til_id = tils.id
              WHERE bookmarks.user_id = ? GROUP BY tils.id`, [req.user.id], (err, rows) => {

      tils = tils_object(rows);
      res.render('bookmarks', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
    });
  });


app.get('/todo',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;

    sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags FROM tils 
              JOIN tags_join ON tags_join.til_id = tils.id 
              JOIN tags ON tags.id = tags_join.tag_id
              JOIN bookmarks ON bookmarks.til_id = tils.id
              WHERE bookmarks.user_id = ? GROUP BY tils.id`, [req.user.id], (err, rows) => {

      tils = tils_object(rows);
      res.render('todo', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
    });
  });


app.get('/login',
  function (req, res) {
    res.render('login');
  });


app.post('/login',
  passport.authenticate('local', { failureRedirect: '/login' }),
  function (req, res) {
    res.redirect('/');
  });


app.get('/logout',
  function (req, res) {
    req.logout();
    res.redirect('/');
  });


app.get('/view/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;
    var bookmarked = false;

    sqldb.get(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
              FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
              JOIN tags ON tags.id = tags_join.tag_id 
              WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`, [req.user.id, req.params.til_id], (err, row) => {
      tils = tils_object([row]);

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


app.get('/study',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;

    sqldb.get("SELECT tils.id from tils WHERE tils.user_id = ? and tils.next_repetition < ? ORDER BY RANDOM() LIMIT 1", [req.user.id, moment().unix()], (err, row) => {

      if (row) {
        sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
                  FROM tils 
                  JOIN tags_join ON tags_join.til_id = tils.id JOIN tags ON tags.id = tags_join.tag_id 
                  WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`, [req.user.id, row.id], (err, rows) => {

          tils = tils_object(rows);

          til = tils[0][tils[1][0]];

          sqldb.all("SELECT * FROM til_comments WHERE til_id = ? and user_id = ?", [req.params.til_id, req.user.id], (err, rows) => {
            comments = rows;

            res.render('study', { til: til, comments: comments, user: req.user });
          });

        });

      } else {
        res.redirect('/');
      }

    });

  });


app.get('/study/:til_id/:study_result',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {


    sqldb.get("SELECT * FROM tils WHERE tils.id = ? AND tils.user_id = ?", [req.params.til_id, req.user.id], (err, row) => {

      repetitions = row.repetitions;

      if (repetitions == 0) {
        repetitions = 1;
      }

      current_dt = moment();
      study_result = req.params.study_result;

      // This is a very simple spaced repetition approach
      if (study_result == 'easy') {
        next_repetition = current_dt.add(14 * repetitions, 'days');
      } else if (study_result == 'ok') {
        next_repetition = current_dt.add(7 * repetitions, 'days');
      } else if (study_result == 'hard') {
        next_repetition = current_dt.add(1, 'days');
      } else if (study_result == 'mute') {
        next_repetition = current_dt.add(90, 'days');
      } else {
        res.redirect(`/study`);
      }

      sqldb.run("UPDATE tils SET repetitions = repetitions + 1, last_repetition = ?, next_repetition = ? WHERE id = ? AND user_id = ?", 
                [moment().unix(), next_repetition.unix(), req.params.til_id, req.user.id], function (err) {
                  
        res.redirect(`/study`);
      });

    });

  });


app.get('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    var title = false;
    if (req.query.title) {
      title = req.query.title;
    }

    res.render('add', { user: req.user, title: title, today: moment().format('YYYY-MM-DD') });
  });


app.post('/add',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    var title = req.body.title;
    var date = new Date(req.body.date).getTime();
    var description = req.body.description;

    var tags = parseHashtags(description);

    if (tags == null) {
      tags = ['#misc'];
    }

    sqldb.run("INSERT INTO tils(user_id, title, description, date) VALUES (?,?,?,?)", [req.user.id, title, description, date], function (err) {
      helpers.updateTags(this.lastID, tags);

      res.redirect(`/view/${this.lastID}`);
    });

  });


app.get('/edit/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.get("SELECT * FROM tils WHERE id = ? and user_id = ?", [req.params.til_id, req.user.id], (err, row) => {

      res.render('edit', { til: row, date: moment(row.date).format('YYYY-MM-DD'), user: req.user });
    });
  });


app.post('/edit/:til_id',
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

      res.redirect(`/view/${req.params.til_id}`);
    });

  });


app.get('/edit/:til_id/addcomment',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    res.render('addcomment', { user: req.user });
  });


app.get('/edit/:til_id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.run("DELETE FROM tils WHERE id = ? AND user_id = ?", [req.params.til_id, req.user.id]);
    res.redirect('/');
  });


app.post('/edit/:til_id/addcomment',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    var comment = req.body.comment;

    sqldb.run("INSERT INTO til_comments(user_id, til_id, comment) VALUES (?,?,?)", [req.user.id, req.params.til_id, comment], function (err) {
      res.redirect(`/view/${req.params.til_id}`);
    });

  });


app.get('/edit/comment/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.get("SELECT * FROM til_comments WHERE id = ? and user_id = ?", [req.params.comment_id, req.user.id], (err, row) => {
      res.render('editcomment', { comment: row, user: req.user });
    });
  });


app.post('/edit/comment/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    sqldb.get("SELECT til_id FROM til_comments WHERE id = ? AND user_id = ?", [req.params.comment_id, req.user.id], function (err, row) {

      sqldb.run("UPDATE til_comments SET comment = ? WHERE id = ? AND user_id = ?", [req.body.comment, req.params.comment_id, req.user.id], function (err) {
        res.redirect(`/view/` + row.til_id);
      });

    });

  });


app.get('/edit/comment/:comment_id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    sqldb.get("SELECT * FROM til_comments WHERE id = ? and user_id = ?", [req.params.comment_id, req.user.id], (err, row) => {
      sqldb.run(`DELETE FROM til_comments WHERE id = ? AND user_id = ?`, [req.params.comment_id, req.user.id]);
      res.redirect(`/view/${row.til_id}`);
    });

  });


app.get('/edit/:til_id/bookmark',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.get("SELECT * FROM bookmarks WHERE til_id = ? and user_id = ?", [req.params.til_id, req.user.id], (err, row) => {

      if (row) {
        // Bookmark exists, delete
        sqldb.run("DELETE FROM bookmarks WHERE til_id = ? and user_id = ?", [req.params.til_id, req.user.id]);
        res.redirect('/view/' + req.params.til_id);

      } else {
        // Bookmark doesn't exist, create
        sqldb.run("INSERT INTO bookmarks(user_id, til_id) VALUES (?,?)", [req.user.id, req.params.til_id]);
        res.redirect('/view/' + req.params.til_id);
      }

    });
  });


app.get('/random',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {

    sqldb.get("SELECT * FROM tils WHERE user_id = ? ORDER BY RANDOM() LIMIT 1", req.user.id, (err, row) => {
      if (row) {
        res.redirect('/view/' + row.id);
      } else {
        res.redirect('/add');
      }
    });

  });


app.get('/tag/:tag',
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

      tils = tils_object(rows);

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


/* A JSON endpoint exposing all tags so that they can be 
used in search. At this point, tags are considered public (in a multiuser scenario).*/
app.get('/json/tags',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    var sql = "SELECT * FROM tags";

    sqldb.all(sql, (err, rows) => {
      if (err) {
        res.status(400).json({ "error": err.message });
        return;
      }

      var tags = []
      rows.forEach(function (tag) {

        if (config.lowercasetags) {
          tags.push(tag.tag.toLowerCase());
        } else {
          tags.push(tag.tag)
        }

      });

      tags = [...new Set(tags)]

      res.json({
        tags
      })
    });
  });


// JSON endpoint for linking between TILs
app.get('/json/findid/:title',
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
      })
    });
  });


app.use(function (req, res, next) {
  res.status(404);

  if (req.accepts('html')) {
    res.render('404', { url: req.url });
    return;
  }
});


app.listen(config.port, '127.0.0.1');