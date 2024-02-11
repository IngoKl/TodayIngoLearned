var express = require('express');
var moment = require('moment');
var sqldb = require('./../../db');
var router = express.Router();
var tilsObject = require('./../../helpers/tilsObject');

router.get('/',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {
    var tils = null;

    sqldb.get("SELECT tils.id from tils WHERE tils.user_id = ? and tils.next_repetition < ? ORDER BY RANDOM() LIMIT 1", [req.user.id, moment().unix()], (err, row) => {

        if (row) {
        sqldb.all(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags 
                    FROM tils 
                    JOIN tags_join ON tags_join.til_id = tils.id JOIN tags ON tags.id = tags_join.tag_id 
                    WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`, [req.user.id, row.id], (err, rows) => {

            tils = tilsObject(rows);

            til = tils[0][tils[1][0]];

            sqldb.all("SELECT * FROM til_comments WHERE til_id = ? and user_id = ?", [req.params.til_id, req.user.id], (err, rows) => {
            comments = rows;

            res.render('study', { til: til, comments: comments, user: req.user });
            });

        });

        } else {
        res.redirect('/');
        }

    });
});

router.get('/:til_id/:study_result',
    require('connect-ensure-login').ensureLoggedIn(),
    function (req, res) {


    sqldb.get("SELECT * FROM tils WHERE tils.id = ? AND tils.user_id = ?", [req.params.til_id, req.user.id], (err, row) => {

        repetitions = row.repetitions;

        if (repetitions == 0) {
        repetitions = 1;
        }

        current_dt = moment();
        study_result = req.params.study_result;

        // This is a very simple spaced repetition approach
        if (study_result == 'easy') {
        next_repetition = current_dt.add(14 * repetitions, 'days');
        } else if (study_result == 'ok') {
        next_repetition = current_dt.add(7 * repetitions, 'days');
        } else if (study_result == 'hard') {
        next_repetition = current_dt.add(1, 'days');
        } else if (study_result == 'mute') {
        next_repetition = current_dt.add(90, 'days');
        } else {
        res.redirect(`/study`);
        }

        sqldb.run("UPDATE tils SET repetitions = repetitions + 1, last_repetition = ?, next_repetition = ? WHERE id = ? AND user_id = ?", 
                [moment().unix(), next_repetition.unix(), req.params.til_id, req.user.id], function (err) {
                    
        res.redirect(`/study`);
        });

    });
});

module.exports = router;