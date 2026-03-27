const express = require('express');
const validate = require('./../../helpers/validate');
const CommentModel = require('./../../models/comment');
const router = express.Router();

router.get('/view/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const row = CommentModel.getById(req.user.id, req.params.comment_id);
      if (!row) return res.status(404).send('Comment not found');
      res.render('comment', { comment: row, user: req.user });
    } catch (err) { next(err); }
  });


router.get('/add/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    res.render('addcomment', { user: req.user });
  });


router.post('/add/:til_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const check = validate.comment(req.body);
      if (!check.valid) {
        return res.status(400).send(check.error);
      }
      CommentModel.create(req.user.id, req.params.til_id, req.body.comment);
      res.redirect(`/til/view/${req.params.til_id}`);
    } catch (err) { next(err); }
  });


router.get('/edit/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const row = CommentModel.getById(req.user.id, req.params.comment_id);
      if (!row) return res.status(404).send('Comment not found');
      res.render('editcomment', { comment: row, user: req.user });
    } catch (err) { next(err); }
  });


router.post('/edit/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const check = validate.comment(req.body);
      if (!check.valid) {
        return res.status(400).send(check.error);
      }
      const row = CommentModel.getById(req.user.id, req.params.comment_id);
      if (!row) return res.status(404).send('Comment not found');
      CommentModel.update(req.user.id, req.params.comment_id, req.body.comment);
      res.redirect('/til/view/' + row.til_id);
    } catch (err) { next(err); }
  });


router.post('/delete/:comment_id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const row = CommentModel.getById(req.user.id, req.params.comment_id);
      if (!row) return res.status(404).send('Comment not found');
      CommentModel.deleteById(req.user.id, req.params.comment_id);
      res.redirect(`/til/view/${row.til_id}`);
    } catch (err) { next(err); }
  });

module.exports = router;
