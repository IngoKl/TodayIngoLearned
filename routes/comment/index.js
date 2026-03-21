const express = require('express');
const sqldb = require('./../../db');
const router = express.Router();

router.get('/view/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT * FROM til_comments WHERE id = ? AND user_id = ?").get(req.params.comment_id, req.user.id);
    if (!row) return res.status(404).send('Comment not found');
    res.render('comment', { comment: row, user: req.user });
  });


router.get('/add/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    res.render('addcomment', { user: req.user });
  });


router.post('/add/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const comment = req.body.comment;
    sqldb.prepare("INSERT INTO til_comments(user_id, til_id, comment) VALUES (?,?,?)").run(req.user.id, req.params.til_id, comment);
    res.redirect(`/til/view/${req.params.til_id}`);
  });


router.get('/edit/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT * FROM til_comments WHERE id = ? AND user_id = ?").get(req.params.comment_id, req.user.id);
    res.render('editcomment', { comment: row, user: req.user });
  });


router.post('/edit/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT til_id FROM til_comments WHERE id = ? AND user_id = ?").get(req.params.comment_id, req.user.id);
    if (!row) return res.status(404).send('Comment not found');
    sqldb.prepare("UPDATE til_comments SET comment = ? WHERE id = ? AND user_id = ?").run(req.body.comment, req.params.comment_id, req.user.id);
    res.redirect('/til/view/' + row.til_id);
  });


router.get('/delete/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const row = sqldb.prepare("SELECT * FROM til_comments WHERE id = ? AND user_id = ?").get(req.params.comment_id, req.user.id);
    if (!row) return res.status(404).send('Comment not found');
    sqldb.prepare('DELETE FROM til_comments WHERE id = ? AND user_id = ?').run(req.params.comment_id, req.user.id);
    res.redirect(`/til/view/${row.til_id}`);
  });

module.exports = router;
