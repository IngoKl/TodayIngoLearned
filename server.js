var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var helpers = require('./helpers');

var apiRoutes = require('./routes/api');
var studyRoutes = require('./routes/study');
var commentRoutes = require('./routes/comment');
var tilRoutes = require('./routes/til');
var userRoutes = require('./routes/user');

const packageJson = require('./package.json');
const version = packageJson.version;

var config = require('./config.json');

var sqldb = require('./db');

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


// Middleware for locals
app.use((req, res, next) => {
  res.locals.version = version;
  next();
});


// Initialize Passport and restore authentication state from the session.
app.use(passport.initialize());
app.use(passport.session());


// Create an object to be used in a template from SQL rows
var tilsObject = require('./helpers/tilsObject');


// Define routes
app.use('/til', tilRoutes);
app.use('/user', userRoutes);
app.use('/comment', commentRoutes);
app.use('/json', apiRoutes);
app.use('/study', studyRoutes);


app.get('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;

    sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
    FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
    JOIN tags ON tags.id = tags_join.tag_id 
    WHERE tils.user_id = ? GROUP BY tils.id ORDER BY tils.id DESC LIMIT 10`, [req.user.id], (err, rows) => {

      tils = tilsObject(rows);
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

        tils = tilsObject(rows);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
      });

    }
    if (searchtype == 'text') {
      var tils = null;
      sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
      JOIN tags ON tags.id = tags_join.tag_id 
      WHERE tils.user_id = ? AND tils.description LIKE ? GROUP BY tils.id`, [req.user.id, `%${search}%`], (err, rows) => {

        tils = tilsObject(rows);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
      });

    }
    else if (searchtype == 'date') {
      var range = helpers.getDateRange(new Date(search).getTime());

      var tils = null;
      sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
      JOIN tags ON tags.id = tags_join.tag_id 
      WHERE tils.user_id = ? and tils.date BETWEEN ? AND ? GROUP BY tils.id`, [req.user.id, range[0], range[1]], (err, rows) => {
        
        tils = tilsObject(rows);
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

        tils = tilsObject(rows);
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

      tils = tilsObject(rows);
      res.render('bookmarks', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
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


app.use(function (req, res, next) {
  res.status(404);

  if (req.accepts('html')) {
    res.render('404', { url: req.url });
    return;
  }
});


app.listen(config.port, '127.0.0.1');