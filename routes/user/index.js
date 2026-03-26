const express = require('express');
const helpers = require('./../../helpers');
const sqldb = require('./../../db');
const router = express.Router();


router.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const user_stats = helpers.getUserStats(req.user.id);
    const row = sqldb.prepare('SELECT api_key FROM users WHERE id = ?').get(req.user.id);
    const publicCount = sqldb.prepare('SELECT COUNT(*) AS count FROM tils WHERE user_id = ? AND public = 1').get(req.user.id).count;
    res.render('profile', { user: req.user, user_stats: user_stats, api_key: row.api_key || null, publicCount: publicCount });
  });


router.post('/api-key',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    helpers.generateApiKey(req.user.id);
    res.redirect('/user/profile');
  });


module.exports = router;
