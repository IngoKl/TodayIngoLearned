const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const helpers = require('./helpers');
const session = require('express-session');
const SQLiteStore = require('better-sqlite3-session-store')(session);
const SQLite = require('better-sqlite3');
const path = require('path');
const helmet = require('helmet');

const apiRoutes = require('./routes/api');
const commentRoutes = require('./routes/comment');
const studyRoutes = require('./routes/study');
const tagRoutes = require('./routes/tag');
const tilRoutes = require('./routes/til');
const userRoutes = require('./routes/user');

const packageJson = require('./package.json');
const version = packageJson.version;

const config = require('./config.json');
const sqldb = require('./db');
const restApiRoutes = require('./routes/rest-api');

// Migrate: add api_key column to users table if it doesn't exist
const userColumns = sqldb.pragma('table_info(users)').map(c => c.name);
if (!userColumns.includes('api_key')) {
  sqldb.exec('ALTER TABLE users ADD COLUMN api_key TEXT');
}

// Create session store with a separate database file
const sessionsDb = new SQLite(path.join(path.dirname(config.dbpath), 'sessions.db'));
const sessionStore = new SQLiteStore({
    client: sessionsDb,
    expired: {
        clear: true,
        intervalMs: 1000 * 60 * 60 // 1 hour
    }
});

// Passport for authentication (with scrypt upgrade on login)
passport.use(new LocalStrategy(function (username, password, cb) {
  const row = sqldb.prepare("SELECT id, username, password FROM users WHERE username = ?").get(username);
  if (!row) return cb(null, false);

  if (!helpers.verifyPassword(password, row.password)) return cb(null, false);

  // Upgrade legacy SHA-256 hash to scrypt on successful login
  if (helpers.isLegacyHash(row.password)) {
    const newHash = helpers.hashPassword(password);
    sqldb.prepare("UPDATE users SET password = ? WHERE id = ?").run(newHash, row.id);
  }

  return cb(null, { id: row.id, username: row.username });
}));


passport.serializeUser(function (user, cb) {
  return cb(null, user.id);
});


passport.deserializeUser(function (id, done) {
  const row = sqldb.prepare("SELECT id, username FROM users WHERE id = ?").get(id);
  if (!row) return done(null, false);
  return done(null, row);
});


// Create a new Express application.
const app = express();


// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');


// Trust the proxy
app.set('trust proxy', 1);


// Security headers
app.use(helmet({
  contentSecurityPolicy: false // disabled to allow inline scripts and CDN resources
}));


// Make all necessary node_module files available
app.use('/static/js', express.static(__dirname + '/node_modules/bootstrap/dist/js'));
app.use('/static/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));
app.use('/static/js', express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/static/js', express.static(__dirname + '/node_modules/showdown/dist'));
app.use('/static/js', express.static(__dirname + '/node_modules/js-autocomplete'));
app.use('/static/css', express.static(__dirname + '/node_modules/js-autocomplete'));


// Make assets available
app.use('/static', express.static('static'));
app.use('/', express.static('public'));


// Middleware
app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ extended: true }));
app.use(require('body-parser').json());
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
const tilsObject = require('./helpers/tilsObject');


// Define routes
app.use('/comment', commentRoutes);
app.use('/json', apiRoutes);
app.use('/study', studyRoutes);
app.use('/tag', tagRoutes);
app.use('/til', tilRoutes);
app.use('/user', userRoutes);
app.use('/api/v1', restApiRoutes);


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
    const rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
    FROM tils JOIN tags_join ON tags_join.til_id = tils.id
    JOIN tags ON tags.id = tags_join.tag_id
    WHERE tils.user_id = ? GROUP BY tils.id ORDER BY tils.id DESC LIMIT 10`).all(req.user.id);

    const tils = tilsObject(rows, req.user.id);
    res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user });
  });


app.post('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const searchtype = req.body.searchtype;
    const search = req.body.search;
    let rows;

    if (searchtype === 'title') {
      rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id
      JOIN tags ON tags.id = tags_join.tag_id
      WHERE tils.user_id = ? AND tils.title LIKE ? GROUP BY tils.id`).all(req.user.id, `%${search}%`);
    }
    else if (searchtype === 'text') {
      rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id
      JOIN tags ON tags.id = tags_join.tag_id
      WHERE tils.user_id = ? AND tils.description LIKE ? GROUP BY tils.id`).all(req.user.id, `%${search}%`);
    }
    else if (searchtype === 'date') {
      const range = helpers.getDateRange(new Date(search).getTime());
      rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id
      JOIN tags ON tags.id = tags_join.tag_id
      WHERE tils.user_id = ? AND tils.date BETWEEN ? AND ? GROUP BY tils.id`).all(req.user.id, range[0], range[1]);
    }
    else if (searchtype === 'tag') {
      rows = sqldb.prepare(`SELECT * FROM (
                  SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
                  FROM tils
                  JOIN tags_join ON tags_join.til_id = tils.id
                  JOIN tags ON tags.id = tags_join.tag_id
                  WHERE tils.user_id = ?
                  GROUP BY tils.id
                ) WHERE tags LIKE ? OR tags LIKE ? OR tags LIKE ?`).all(req.user.id, `${search}`, `%${search},%`, `%,${search}`);
    }

    if (rows) {
      const tils = tilsObject(rows, req.user.id);
      res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user, searchtype: searchtype, search: search });
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
