var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var helpers = require('./helpers');
var session = require('express-session');
var SQLiteStore = require('better-sqlite3-session-store')(session);
var SQLite = require('better-sqlite3');
var path = require('path');

var apiRoutes = require('./routes/api');
var commentRoutes = require('./routes/comment');
var studyRoutes = require('./routes/study');
var tagRoutes = require('./routes/tag');
var tilRoutes = require('./routes/til');
var userRoutes = require('./routes/user');

const packageJson = require('./package.json');
const version = packageJson.version;

var config = require('./config.json');
var sqldb = require('./db');

// Create session store with a separate database file
const sessionsDb = new SQLite(path.join(path.dirname(config.dbpath), 'sessions.db'));
const sessionStore = new SQLiteStore({
    client: sessionsDb,
    expired: {
        clear: true,
        intervalMs: 1000 * 60 * 60 // 1 hour
    }
});

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
app.use('/static/js', express.static(__dirname + '/node_modules/darkmode-js/lib'));


// Make assets available
app.use('/static', express.static('static'));
app.use('/', express.static('public'));


// Middleware
app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('express-session')({ 
  store: sessionStore,
  secret: config.expresssessionsecret, 
  resave: false, 
  saveUninitialized: false,
  cookie: {
    secure: config.securecoockies, 
    maxAge: config.maxage
  }
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
app.use('/comment', commentRoutes);
app.use('/json', apiRoutes);
app.use('/study', studyRoutes);
app.use('/tag', tagRoutes);
app.use('/til', tilRoutes);
app.use('/user', userRoutes);


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
  function (req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });


app.get('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var tils = null;

    sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
    FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
    JOIN tags ON tags.id = tags_join.tag_id 
    WHERE tils.user_id = ? GROUP BY tils.id ORDER BY tils.id DESC LIMIT 10`, [req.user.id], (err, rows) => {

      tils = tilsObject(rows, req.user.id);
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

        tils = tilsObject(rows, req.user.id);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user, searchtype: searchtype, search: search });
      });

    }
    if (searchtype == 'text') {
      var tils = null;
      sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
      JOIN tags ON tags.id = tags_join.tag_id 
      WHERE tils.user_id = ? AND tils.description LIKE ? GROUP BY tils.id`, [req.user.id, `%${search}%`], (err, rows) => {

        tils = tilsObject(rows, req.user.id);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user, searchtype: searchtype, search: search});
      });

    }
    else if (searchtype == 'date') {
      var range = helpers.getDateRange(new Date(search).getTime());

      var tils = null;
      sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id 
      JOIN tags ON tags.id = tags_join.tag_id 
      WHERE tils.user_id = ? and tils.date BETWEEN ? AND ? GROUP BY tils.id`, [req.user.id, range[0], range[1]], (err, rows) => {
        
        tils = tilsObject(rows, req.user.id);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user, searchtype: searchtype, search: search });
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

        tils = tilsObject(rows, req.user.id);
        res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user, searchtype: searchtype, search: search });
      });

    }
  });


app.use(function (req, res, next) {
  res.status(404);

  if (req.accepts('html')) {
    res.render('404', { url: req.url });
    return;
  }
});


app.listen(config.port, '127.0.0.1');