const express = require('express');
const dayjs = require('dayjs');
const sqldb = require('./../../db');
const { TIL_BASE_QUERY } = require('./../../helpers/queries');
const router = express.Router();
const tilsObject = require('./../../helpers/tilsObject');

router.get('/stats',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {

    const total_tils = sqldb.prepare("SELECT COUNT(*) AS count FROM tils WHERE user_id = ?").get(req.user.id).count;
    const studied = sqldb.prepare("SELECT COUNT(*) AS count FROM tils WHERE user_id = ? AND repetitions > 0").get(req.user.id).count;
    const never_studied = total_tils - studied;
    // next_repetition is in Unix seconds (see helpers/queries.js for date conventions)
    const due_now = sqldb.prepare("SELECT COUNT(*) AS count FROM tils WHERE user_id = ? AND next_repetition < ?").get(req.user.id, dayjs().unix()).count;
    const total_repetitions = sqldb.prepare("SELECT COALESCE(SUM(repetitions), 0) AS total FROM tils WHERE user_id = ?").get(req.user.id).total;

    const tils = sqldb.prepare(`SELECT tils.id, tils.title, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
                FROM tils
                LEFT JOIN tags_join ON tags_join.til_id = tils.id
                LEFT JOIN tags ON tags.id = tags_join.tag_id
                WHERE tils.user_id = ? AND tils.repetitions > 0
                GROUP BY tils.id
                ORDER BY tils.next_repetition ASC`).all(req.user.id);

    res.render('study_stats', {
        user: req.user,
        stats: { total_tils, studied, never_studied, due_now, total_repetitions },
        tils: tils
    });
});

router.get('/',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {

    // next_repetition is in Unix seconds (see helpers/queries.js for date conventions)
    const pick = sqldb.prepare("SELECT tils.id FROM tils WHERE tils.user_id = ? AND tils.next_repetition < ? ORDER BY RANDOM() LIMIT 1").get(req.user.id, dayjs().unix());

    if (pick) {
        const rows = sqldb.prepare(`${TIL_BASE_QUERY}
                    WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`).all(req.user.id, pick.id);

        const tils = tilsObject(rows);
        const til = tils[0][tils[1][0]];

        const comments = sqldb.prepare("SELECT * FROM til_comments WHERE til_id = ? AND user_id = ?").all(pick.id, req.user.id);

        res.render('study', { til: til, comments: comments, user: req.user });
    } else {
        res.redirect('/');
    }
});

router.get('/:til_id/:study_result',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {

    const row = sqldb.prepare("SELECT * FROM tils WHERE tils.id = ? AND tils.user_id = ?").get(req.params.til_id, req.user.id);

    let repetitions = row.repetitions;
    if (repetitions === 0) {
        repetitions = 1;
    }

    let current_dt = dayjs();
    const study_result = req.params.study_result;

    // last_repetition and next_repetition are stored as Unix seconds
    let next_repetition;
    if (study_result === 'easy') {
        next_repetition = current_dt.add(14 * repetitions, 'day');
    } else if (study_result === 'ok') {
        next_repetition = current_dt.add(7 * repetitions, 'day');
    } else if (study_result === 'hard') {
        next_repetition = current_dt.add(1, 'day');
    } else if (study_result === 'mute') {
        next_repetition = current_dt.add(90, 'day');
    } else {
        return res.redirect('/study');
    }

    sqldb.prepare("UPDATE tils SET repetitions = repetitions + 1, last_repetition = ?, next_repetition = ? WHERE id = ? AND user_id = ?")
        .run(dayjs().unix(), next_repetition.unix(), req.params.til_id, req.user.id);

    res.redirect('/study');
});

module.exports = router;
