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
const todoRoutes = require('./routes/todo');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const packageJson = require('./package.json');
const version = packageJson.version;

const config = require('./config.json');
const sqldb = require('./db');
const restApiRoutes = require('./routes/rest-api');

// Run database migrations
require('./db/migrate')();

// Clean up orphan images older than 24 hours on startup
helpers.cleanupOrphanImages();

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
  const row = sqldb.prepare("SELECT id, username, is_admin FROM users WHERE id = ?").get(id);
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
app.use('/static/js/hljs', express.static(__dirname + '/node_modules/@highlightjs/cdn-assets'));
app.use('/static/css/hljs', express.static(__dirname + '/node_modules/@highlightjs/cdn-assets/styles'));


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
    secure: config.securecookies,
    maxAge: config.maxage
  }
}));


// Middleware for locals
app.use((req, res, next) => {
  res.locals.version = version;
  res.locals.appName = config.name || 'TodayIngoLearned';
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
app.use('/todo', todoRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
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
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = 10;
    const offset = (page - 1) * perPage;

    const totalCount = sqldb.prepare(`SELECT COUNT(DISTINCT tils.id) AS count
    FROM tils JOIN tags_join ON tags_join.til_id = tils.id
    WHERE tils.user_id = ?`).get(req.user.id).count;

    const rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags
    FROM tils JOIN tags_join ON tags_join.til_id = tils.id
    JOIN tags ON tags.id = tags_join.tag_id
    WHERE tils.user_id = ? GROUP BY tils.id ORDER BY tils.date DESC, tils.id DESC LIMIT ? OFFSET ?`).all(req.user.id, perPage, offset);

    const tils = tilsObject(rows, req.user.id);
    const totalPages = Math.ceil(totalCount / perPage);
    res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user, page: page, totalPages: totalPages });
  });


app.post('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const searchtype = req.body.searchtype;
    const search = req.body.search;
    let rows;

    if (searchtype === 'title') {
      rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id
      JOIN tags ON tags.id = tags_join.tag_id
      WHERE tils.user_id = ? AND tils.title LIKE ? GROUP BY tils.id`).all(req.user.id, `%${search}%`);
    }
    else if (searchtype === 'text') {
      rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id
      JOIN tags ON tags.id = tags_join.tag_id
      WHERE tils.user_id = ? AND tils.description LIKE ? GROUP BY tils.id`).all(req.user.id, `%${search}%`);
    }
    else if (searchtype === 'date') {
      const range = helpers.getDateRange(new Date(search).getTime());
      rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags
      FROM tils JOIN tags_join ON tags_join.til_id = tils.id
      JOIN tags ON tags.id = tags_join.tag_id
      WHERE tils.user_id = ? AND tils.date BETWEEN ? AND ? GROUP BY tils.id`).all(req.user.id, range[0], range[1]);
    }
    else if (searchtype === 'tag') {
      rows = sqldb.prepare(`SELECT * FROM (
                  SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags
                  FROM tils
                  JOIN tags_join ON tags_join.til_id = tils.id
                  JOIN tags ON tags.id = tags_join.tag_id
                  WHERE tils.user_id = ?
                  GROUP BY tils.id
                ) WHERE tags LIKE ? OR tags LIKE ? OR tags LIKE ?`).all(req.user.id, `${search}`, `%${search},%`, `%,${search}`);
    }

    if (!rows) {
      return res.redirect('/');
    }

    const page = Math.max(1, parseInt(req.body.page) || 1);
    const perPage = 10;
    const totalPages = Math.ceil(rows.length / perPage);
    const paginatedRows = rows.slice((page - 1) * perPage, page * perPage);
    const tils = tilsObject(paginatedRows, req.user.id);
    res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user, searchtype: searchtype, search: search, page: page, totalPages: totalPages });
  });


// Public TIL view (no authentication required)
app.get('/public/:til_id',
  function (req, res) {
    const row = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.public, GROUP_CONCAT(tags.tag) AS tags
              FROM tils JOIN tags_join ON tags_join.til_id = tils.id
              JOIN tags ON tags.id = tags_join.tag_id
              WHERE tils.id = ? AND tils.public = 1 GROUP BY tils.id`).get(req.params.til_id);

    if (!row) {
      return res.status(404).render('404', { url: req.url });
    }

    const tils = tilsObject([row]);
    const til = tils[0][tils[1][0]];
    let til_urls = til.description.match(/\b(?:https?:\/\/|www\.)(\S(?<!\)))+/gi);
    if (til_urls) {
      til_urls = [...new Set(til_urls.map(url => url.match(/^https?:\/\//) ? url : 'https://' + url))];
    }

    const til_images = sqldb.prepare('SELECT id, filename, mime_type FROM til_images WHERE til_id = ?').all(req.params.til_id);

    res.render('public_view', { til: til, til_urls: til_urls, til_images: til_images });
  });


// Serve images from the database (with ownership check)
app.get('/image/:id', function (req, res) {
  const row = sqldb.prepare(`
    SELECT til_images.image_data, til_images.mime_type, til_images.filename,
           til_images.til_id, tils.user_id, tils.public AS is_public
    FROM til_images
    LEFT JOIN tils ON tils.id = til_images.til_id
    WHERE til_images.id = ?
  `).get(req.params.id);

  if (!row) {
    return res.status(404).send('Image not found');
  }

  // Access control: owner or public TIL
  const isOwner = req.isAuthenticated && req.isAuthenticated() && req.user && row.user_id === req.user.id;
  const isPublic = row.is_public === 1;
  const isOrphan = row.til_id === null;

  if (!isOwner && !isPublic && !isOrphan) {
    return res.status(403).send('Forbidden');
  }

  // Orphan images require authentication (uploaded during add flow)
  if (isOrphan && !(req.isAuthenticated && req.isAuthenticated())) {
    return res.status(403).send('Forbidden');
  }

  res.set('Content-Type', row.mime_type);
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(row.image_data);
});


app.use(function (req, res, next) {
  res.status(404);

  if (req.accepts('html')) {
    res.render('404', { url: req.url });
    return;
  }
});


app.listen(config.port, '127.0.0.1');
