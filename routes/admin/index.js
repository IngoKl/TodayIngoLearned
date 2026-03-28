const express = require('express');
const ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
const helpers = require('./../../helpers');
const validate = require('./../../helpers/validate');
const UserModel = require('./../../models/user');
const Settings = require('./../../models/settings');
const router = express.Router();


function ensureAdmin(req, res, next) {
  if (req.user && req.user.is_admin) return next();
  res.status(403).render('404', { url: req.url, user: req.user || null });
}


router.get('/',
  ensureLoggedIn(),
  ensureAdmin,
  function (req, res, next) {
    try {
      const users = UserModel.listWithStats();
      const noteColors = Settings.getNoteColorsString();
      const penColors = Settings.getPenColorsString();

      res.render('admin', {
        user: req.user,
        users: users,
        query: req.query,
        noteColors: noteColors,
        penColors: penColors
      });
    } catch (err) { next(err); }
  });


router.post('/createuser',
  ensureLoggedIn(),
  ensureAdmin,
  function (req, res, next) {
    try {
      const check = validate.createUser(req.body);
      if (!check.valid) {
        return res.redirect('/admin?error=' + encodeURIComponent(check.error));
      }

      const { username, password, displayname } = req.body;

      if (UserModel.existsByUsername(username)) {
        return res.redirect('/admin?error=Username already exists');
      }

      const hashed_password = helpers.hashPassword(password);
      UserModel.create(username, hashed_password, displayname);

      res.redirect('/admin?success=User created successfully');
    } catch (err) { next(err); }
  });


router.post('/settings/colors',
  ensureLoggedIn(),
  ensureAdmin,
  function (req, res, next) {
    try {
      const noteColors = (req.body.note_colors || '').trim();
      const penColors = (req.body.pen_colors || '').trim();

      if (noteColors && validate.colorString(noteColors)) {
        Settings.set('note_colors', noteColors);
      }

      if (penColors && validate.colorString(penColors)) {
        Settings.set('pen_colors', penColors);
      }

      res.redirect('/admin?success=Color settings updated');
    } catch (err) { next(err); }
  });


module.exports = router;
