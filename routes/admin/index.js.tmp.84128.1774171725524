const express = require('express');
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
const sqldb = require('./../../db');
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

    res.render('admin', { user: req.user, users: users });
  });


module.exports = router;
