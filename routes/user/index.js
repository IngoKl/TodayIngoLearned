const express = require('express');
const helpers = require('./../../helpers');
const router = express.Router();


router.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const user_stats = helpers.getUserStats(req.user.id);
    res.render('profile', { user: req.user, user_stats: user_stats });
  });


module.exports = router;
