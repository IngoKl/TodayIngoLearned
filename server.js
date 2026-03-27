const crypto = require('crypto');
const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const helpers = require('./helpers');
const session = require('express-session');
const SQLiteStore = require('better-sqlite3-session-store')(session);
const SQLite = require('better-sqlite3');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const apiRoutes = require('./routes/api');
const commentRoutes = require('./routes/comment');
const studyRoutes = require('./routes/study');
const tagRoutes = require('./routes/tag');
const tilRoutes = require('./routes/til');
const todoRoutes = require('./routes/todo');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const notesRoutes = require('./routes/notes');

const packageJson = require('./package.json');
const version = packageJson.version;

const config = require('./config.json');
const sqldb = require('./db');
const restApiRoutes = require('./routes/rest-api');

const TilModel = require('./models/til');
const UserModel = require('./models/user');
const ImageModel = require('./models/image');
const Settings = require('./models/settings');
const dates = require('./helpers/dates');
const validate = require('./helpers/validate');
const tilsObject = require('./helpers/tilsObject');

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
  const row = UserModel.getByUsername(username);
  if (!row) return cb(null, false);

  if (!helpers.verifyPassword(password, row.password)) return cb(null, false);

  // Upgrade legacy SHA-256 hash to scrypt on successful login
  if (helpers.isLegacyHash(row.password)) {
    const newHash = helpers.hashPassword(password);
    UserModel.updatePassword(row.id, newHash);
  }

  return cb(null, { id: row.id, username: row.username });
}));


passport.serializeUser(function (user, cb) {
  return cb(null, user.id);
});


passport.deserializeUser(function (id, done) {
  const row = UserModel.getById(id);
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


// Generate a nonce per request for CSP
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  next();
});


// Security headers with CSP
app.use((req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", `'nonce-${res.locals.nonce}'`, "https://kit.fontawesome.com", "https://ka-f.fontawesome.com", "https://d3js.org"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://ka-f.fontawesome.com"],
        fontSrc: ["'self'", "https://ka-f.fontawesome.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://ka-f.fontawesome.com"],
      }
    }
  })(req, res, next);
});


// Make all necessary node_module files available
app.use('/static/js', express.static(__dirname + '/node_modules/bootstrap/dist/js'));
app.use('/static/css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));
app.use('/static/js', express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/static/js', express.static(__dirname + '/node_modules/showdown/dist'));
app.use('/static/js', express.static(__dirname + '/node_modules/js-autocomplete'));
app.use('/static/css', express.static(__dirname + '/node_modules/js-autocomplete'));
app.use('/static/js/hljs', express.static(__dirname + '/node_modules/@highlightjs/cdn-assets'));
app.use('/static/css/hljs', express.static(__dirname + '/node_modules/@highlightjs/cdn-assets/styles'));
app.use('/static/js', express.static(__dirname + '/node_modules/dompurify/dist'));


// Make assets available
app.use('/static', express.static('static'));
app.use('/', express.static('public'));


// Middleware
app.use(require('morgan')('combined'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(require('express-session')({
  store: sessionStore,
  secret: config.expresssessionsecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.securecookies,
    sameSite: 'lax',
    maxAge: config.maxage
  }
}));


// Middleware for locals
app.use((req, res, next) => {
  res.locals.version = version;
  res.locals.appName = config.name || 'TodayIngoLearned';
  res.locals.appSettings = Settings.getAll();
  next();
});


// Initialize Passport and restore authentication state from the session.
app.use(passport.initialize());
app.use(passport.session());


// --- CSRF Protection ---
// Generate a CSRF token per session and verify on state-changing requests.
// REST API routes (authenticated via API key) are exempt.
app.use((req, res, next) => {
  // Ensure session has a CSRF token
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

function verifyCsrf(req, res, next) {
  const token = req.body._csrf || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).send('Invalid or missing CSRF token');
  }
  next();
}

// Apply CSRF verification to all POST/PUT/DELETE except REST API
app.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  // Exempt: REST API (uses API key auth)
  if (req.path.startsWith('/api/v1/')) {
    return next();
  }
  verifyCsrf(req, res, next);
});


// --- Rate Limiting ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts, please try again later.',
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use('/api/v1', apiLimiter);


// --- Health Endpoint ---
app.get('/health', function (req, res) {
  try {
    sqldb.prepare('SELECT 1').get();
    res.json({ status: 'ok', version: version, uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: 'Database unavailable' });
  }
});


// Define routes
app.use('/comment', commentRoutes);
app.use('/json', apiRoutes);
app.use('/study', studyRoutes);
app.use('/tag', tagRoutes);
app.use('/til', tilRoutes);
app.use('/todo', todoRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/notes', notesRoutes);
app.use('/api/v1', restApiRoutes);


app.get('/login',
  function (req, res) {
    let error = null;
    if (req.query.error === 'invalid_credentials') {
      error = 'Invalid username or password.';
    }
    res.render('login', { error: error });
  });


app.post('/login',
  loginLimiter,
  passport.authenticate('local', { failureRedirect: '/login?error=invalid_credentials' }),
  function (req, res) {
    res.redirect('/');
  });


app.post('/logout',
  function (req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });


// Shared search logic for GET (pagination) and POST (form submit)
function handleSearch(req, res, next) {
  try {
    const searchtype = req.body.searchtype || req.query.searchtype;
    const search = req.body.search || req.query.search;
    const requestedPage = Math.max(1, parseInt(req.body.page || req.query.page) || 1);
    const perPage = 10;

    // No search — show default paginated list
    if (!search || !validate.searchType(searchtype)) {
      const totalCount = TilModel.countAll(req.user.id);
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / perPage) : 0;
      const page = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
      const offset = (page - 1) * perPage;
      const rows = TilModel.listPaged(req.user.id, perPage, offset);
      const tils = tilsObject(rows, req.user.id);
      return res.render('index', {
        tils_objects: tils[0],
        tils_keys: tils[1],
        user: req.user,
        page: page,
        totalPages: totalPages,
        totalResults: totalCount,
        searchtype: 'title',
        search: ''
      });
    }

    let rows = [];
    let totalCount = 0;
    let page = requestedPage;
    let offset = 0;

    if (searchtype === 'title') {
      totalCount = TilModel.countSearchByTitle(req.user.id, search);
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / perPage) : 0;
      page = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
      offset = (page - 1) * perPage;
      rows = TilModel.searchByTitlePaged(req.user.id, search, perPage, offset);
    }
    else if (searchtype === 'text') {
      totalCount = TilModel.countSearchByText(req.user.id, search);
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / perPage) : 0;
      page = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
      offset = (page - 1) * perPage;
      rows = TilModel.searchByTextPaged(req.user.id, search, perPage, offset);

      // Build snippets in JS since snippet() doesn't work with external-content FTS
      const searchLower = search.toLowerCase();
      for (const row of rows) {
        const desc = row.description || '';
        const idx = desc.toLowerCase().indexOf(searchLower);
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(desc.length, idx + search.length + 40);
          const before = (start > 0 ? '...' : '') + desc.substring(start, idx).replace(/</g, '&lt;');
          const match = '<mark>' + desc.substring(idx, idx + search.length).replace(/</g, '&lt;') + '</mark>';
          const after = desc.substring(idx + search.length, end).replace(/</g, '&lt;') + (end < desc.length ? '...' : '');
          row.snippet = before + match + after;
        }
      }
    }
    else if (searchtype === 'date') {
      const range = dates.dayRangeMillis(dates.toMillis(search));
      totalCount = TilModel.countSearchByDate(req.user.id, range[0], range[1]);
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / perPage) : 0;
      page = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
      offset = (page - 1) * perPage;
      rows = TilModel.searchByDatePaged(req.user.id, range[0], range[1], perPage, offset);
    }
    else if (searchtype === 'tag') {
      totalCount = TilModel.countSearchByTag(req.user.id, search);
      const totalPages = totalCount > 0 ? Math.ceil(totalCount / perPage) : 0;
      page = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
      offset = (page - 1) * perPage;
      rows = TilModel.searchByTagPaged(req.user.id, search, perPage, offset);
    }

    if (!rows) {
      return res.redirect('/');
    }

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / perPage) : 0;
    const tils = tilsObject(rows, req.user.id);
    res.render('index', { tils_objects: tils[0], tils_keys: tils[1], user: req.user, searchtype: searchtype, search: search, page: page, totalPages: totalPages, totalResults: totalCount });
  } catch (err) { next(err); }
}

app.get('/',
  require('connect-ensure-login').ensureLoggedIn(),
  handleSearch);

app.post('/',
  require('connect-ensure-login').ensureLoggedIn(),
  handleSearch);


// Public profile page — lists all public TILs for a user
// (must be registered before /public/:til_id to avoid "user" matching as a til_id)
app.get('/public/user/:user_id',
  function (req, res, next) {
    try {
      const author = UserModel.getIdAndDisplayName(req.params.user_id);
      if (!author) {
        return res.status(404).render('404', { url: req.url, user: req.user || null });
      }

      const rows = TilModel.listPublicByUser(req.params.user_id);
      const tils = tilsObject(rows);

      res.render('public_profile', { tils_objects: tils[0], tils_keys: tils[1], author: author.displayname, userId: author.id });
    } catch (err) { next(err); }
  });


// Public TIL view (no authentication required)
app.get('/public/:til_id',
  function (req, res, next) {
    try {
      const row = TilModel.getPublicById(req.params.til_id);

      if (!row) {
        return res.status(404).render('404', { url: req.url, user: req.user || null });
      }

      const tils = tilsObject([row]);
      const til = tils[0][tils[1][0]];
      let til_urls = til.description.match(/\b(?:https?:\/\/|www\.)(\S(?<!\)))+/gi);
      if (til_urls) {
        til_urls = [...new Set(til_urls.map(url => url.match(/^https?:\/\//) ? url : 'https://' + url))];
      }

      const tilRow = sqldb.prepare('SELECT user_id FROM tils WHERE id = ?').get(req.params.til_id);
      const userId = tilRow.user_id;
      const author = UserModel.getDisplayName(userId);
      const til_images = ImageModel.listByTil(req.params.til_id);
      const publicCount = UserModel.getPublicTilCount(userId);

      res.render('public_view', { til: til, til_urls: til_urls, til_images: til_images, author: author || 'Unknown', authorPublicCount: publicCount, userId: userId });
    } catch (err) { next(err); }
  });


// Serve images from the database (with ownership check)
app.get('/image/:id', function (req, res, next) {
  try {
    const row = ImageModel.getWithAccess(req.params.id);

    if (!row) {
      return res.status(404).send('Image not found');
    }

    // Access control: owner or public TIL
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    const ownerUserId = row.owner_user_id || row.til_user_id;
    const isOwner = isAuthenticated && req.user && ownerUserId === req.user.id;
    const isPublic = row.is_public === 1;
    const isTemporaryUpload = row.til_id === null && (row.source === 'til' || row.source === null);

    if (!isOwner && !isPublic && !isTemporaryUpload) {
      return res.status(403).send('Forbidden');
    }

    if (isTemporaryUpload && !isOwner) {
      return res.status(403).send('Forbidden');
    }

    res.set('Content-Type', row.mime_type);
    res.set('Cache-Control', isPublic ? 'public, max-age=31536000, immutable' : 'private, max-age=31536000, immutable');
    res.send(row.image_data);
  } catch (err) { next(err); }
});


// 404 handler
app.use(function (req, res, next) {
  res.status(404);

  if (req.accepts('html')) {
    res.render('404', { url: req.url, user: req.user || null });
    return;
  }

  res.json({ error: 'Not found' });
});


// Global error handler
app.use(function (err, req, res, next) {
  console.error(err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;

  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(status).json({ error: 'Internal server error' });
  }

  res.status(status).render('error', {
    message: status === 500 ? 'An unexpected error occurred.' : err.message,
    user: req.user || null
  });
});


app.listen(config.port, process.env.HOST || config.host || '0.0.0.0');
