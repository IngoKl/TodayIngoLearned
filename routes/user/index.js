var express = require('express');
var passport = require('passport');
var helpers = require('./../../helpers');
var router = express.Router();


router.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    helpers.getUserStats(req.user.id)
    .then(user_stats => {
        res.render('profile', { user: req.user, user_stats: user_stats });
    })
    .catch(error => {
        console.log('LOL');
        console.error('Error getting user stats:', error);
        res.render('profile', { user: req.user, user_stats: null }); // Handle the error appropriately
    });
  });


module.exports = router;