const express = require('express');
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
const sqldb = require('./../../db');
const helpers = require('./../../helpers');
const router = express.Router();


function ensureAdmin(req, res, next) {
  if (req.user && req.user.is_admin) return next();
  res.status(403).render('404', { url: req.url });
}


router.get('/',
  ensureLoggedIn(),
  ensureAdmin,
  function (req, res) {
    const users = sqldb.prepare(`
      SELECT
        u.id,
        u.username,
        u.displayname,
        u.is_admin,
        (SELECT COUNT(*) FROM tils WHERE user_id = u.id) AS tils_count,
        (SELECT COUNT(DISTINCT tag_id) FROM tags_join JOIN tils ON tils.id = tags_join.til_id WHERE tils.user_id = u.id) AS tags_count,
        (SELECT COUNT(*) FROM bookmarks WHERE user_id = u.id) AS bookmarks_count,
        (SELECT COUNT(*) FROM til_comments WHERE user_id = u.id) AS comments_count
      FROM users u
      ORDER BY u.id ASC
    `).all();

    // Load app settings
    const noteColorsRow = sqldb.prepare("SELECT value FROM app_settings WHERE key = 'note_colors'").get();
    const penColorsRow = sqldb.prepare("SELECT value FROM app_settings WHERE key = 'pen_colors'").get();

    res.render('admin', {
      user: req.user,
      users: users,
      query: req.query,
      noteColors: noteColorsRow ? noteColorsRow.value : '#fffffc,#508991,#fe5f55,#0b1d51,#1e2019',
      penColors: penColorsRow ? penColorsRow.value : '#4ecdc4,#ffc145,#fffbff,#364652,#ca1551'
    });
  });


router.post('/createuser',
  ensureLoggedIn(),
  ensureAdmin,
  function (req, res) {
    const { username, password, displayname } = req.body;

    if (!username || !password) {
      return res.redirect('/admin?error=Username and password are required');
    }

    const existing = sqldb.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.redirect('/admin?error=Username already exists');
    }

    const hashed_password = helpers.hashPassword(password);
    sqldb.prepare('INSERT INTO users(username, password, displayname) VALUES (?,?,?)').run(username, hashed_password, displayname || username);

    res.redirect('/admin?success=User created successfully');
  });


router.post('/settings/colors',
  ensureLoggedIn(),
  ensureAdmin,
  function (req, res) {
    const noteColors = (req.body.note_colors || '').trim();
    const penColors = (req.body.pen_colors || '').trim();

    // Validate: must be comma-separated hex colors
    const hexPattern = /^#[0-9a-fA-F]{6}(,#[0-9a-fA-F]{6})*$/;

    if (noteColors && hexPattern.test(noteColors)) {
      const existing = sqldb.prepare("SELECT key FROM app_settings WHERE key = 'note_colors'").get();
      if (existing) {
        sqldb.prepare("UPDATE app_settings SET value = ? WHERE key = 'note_colors'").run(noteColors);
      } else {
        sqldb.prepare("INSERT INTO app_settings(key, value) VALUES ('note_colors', ?)").run(noteColors);
      }
    }

    if (penColors && hexPattern.test(penColors)) {
      const existing = sqldb.prepare("SELECT key FROM app_settings WHERE key = 'pen_colors'").get();
      if (existing) {
        sqldb.prepare("UPDATE app_settings SET value = ? WHERE key = 'pen_colors'").run(penColors);
      } else {
        sqldb.prepare("INSERT INTO app_settings(key, value) VALUES ('pen_colors', ?)").run(penColors);
      }
    }

    res.redirect('/admin?success=Color settings updated');
  });


module.exports = router;
