var express = require('express');
var sqldb = require('./../../db');
var helpers = require('./../../helpers');
var router = express.Router();

router.get('/view/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.get("SELECT * FROM til_comments WHERE id = ? and user_id = ?", [req.params.comment_id, req.user.id], (err, row) => {
      res.render('comment', { comment: row, user: req.user });
    });
  });
  

router.get('/add/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    res.render('addcomment', { user: req.user });
  });


router.post('/add/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    var comment = req.body.comment;

    sqldb.run("INSERT INTO til_comments(user_id, til_id, comment) VALUES (?,?,?)", [req.user.id, req.params.til_id, comment], function (err) {
      res.redirect(`/til/view/${req.params.til_id}`);
    });

  });


router.get('/edit/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.get("SELECT * FROM til_comments WHERE id = ? and user_id = ?", [req.params.comment_id, req.user.id], (err, row) => {
      res.render('editcomment', { comment: row, user: req.user });
    });
  });


router.post('/edit/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    sqldb.get("SELECT til_id FROM til_comments WHERE id = ? AND user_id = ?", [req.params.comment_id, req.user.id], function (err, row) {

      sqldb.run("UPDATE til_comments SET comment = ? WHERE id = ? AND user_id = ?", [req.body.comment, req.params.comment_id, req.user.id], function (err) {
        res.redirect(`/til/view/` + row.til_id);
      });

    });

  });


router.get('/delete/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {A

    sqldb.get("SELECT * FROM til_comments WHERE id = ? and user_id = ?", [req.params.comment_id, req.user.id], (err, row) => {
      sqldb.run(`DELETE FROM til_comments WHERE id = ? AND user_id = ?`, [req.params.comment_id, req.user.id]);
      res.redirect(`/til/view/${row.til_id}`);
    });

  });

module.exports = router;