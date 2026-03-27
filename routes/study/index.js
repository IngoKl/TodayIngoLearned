const express = require('express');
const dayjs = require('dayjs');
const validate = require('./../../helpers/validate');
const dates = require('./../../helpers/dates');
const TilModel = require('./../../models/til');
const CommentModel = require('./../../models/comment');
const router = express.Router();
const tilsObject = require('./../../helpers/tilsObject');

router.get('/stats',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res, next) {
    try {
      const nowUnix = dates.nowUnixSeconds();
      const stats = TilModel.getStudyStats(req.user.id, nowUnix);
      const tils = TilModel.getStudiedTils(req.user.id);

      res.render('study_stats', {
          user: req.user,
          stats: stats,
          tils: tils
      });
    } catch (err) { next(err); }
});

router.get('/',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res, next) {
    try {
      const nowUnix = dates.nowUnixSeconds();
      const pick = TilModel.getNextStudyPick(req.user.id, nowUnix);

      if (pick) {
          const rows = [TilModel.getById(req.user.id, pick.id)];
          const tils = tilsObject(rows);
          const til = tils[0][tils[1][0]];
          const comments = CommentModel.listByTil(pick.id, req.user.id);

          res.render('study', { til: til, comments: comments, user: req.user });
      } else {
          res.redirect('/');
      }
    } catch (err) { next(err); }
});

router.post('/:til_id/:study_result',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res, next) {
    try {
      const study_result = req.params.study_result;
      if (!validate.studyResult(study_result)) {
          return res.redirect('/study');
      }

      const row = TilModel.getByIdRaw(req.user.id, req.params.til_id);
      if (!row) return res.redirect('/study');

      let repetitions = row.repetitions;
      if (repetitions === 0) {
          repetitions = 1;
      }

      let current_dt = dayjs();

      let next_repetition;
      if (study_result === 'easy') {
          next_repetition = current_dt.add(14 * repetitions, 'day');
      } else if (study_result === 'ok') {
          next_repetition = current_dt.add(7 * repetitions, 'day');
      } else if (study_result === 'hard') {
          next_repetition = current_dt.add(1, 'day');
      } else if (study_result === 'mute') {
          next_repetition = current_dt.add(90, 'day');
      }

      TilModel.recordStudy(req.user.id, req.params.til_id, dates.nowUnixSeconds(), next_repetition.unix());

      res.redirect('/study');
    } catch (err) { next(err); }
});

module.exports = router;
