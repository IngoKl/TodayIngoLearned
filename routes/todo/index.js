const express = require('express');
const TilModel = require('./../../models/til');
const router = express.Router();
const tilsObject = require('./../../helpers/tilsObject');

router.get('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const todoRows = TilModel.getTodoTils(req.user.id);
      const todoTils = tilsObject(todoRows);

      const emptyRows = TilModel.getEmptyTils(req.user.id);
      const emptyTils = tilsObject(emptyRows);

      res.render('todo', {
        todo_objects: todoTils[0], todo_keys: todoTils[1],
        empty_objects: emptyTils[0], empty_keys: emptyTils[1],
        user: req.user
      });
    } catch (err) { next(err); }
  });

module.exports = router;
