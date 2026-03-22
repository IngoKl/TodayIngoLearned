const express = require('express');
const sqldb = require('./../../db');
const helpers = require('./../../helpers');
const parseHashtags = require('./../../helpers/parseHashtags');
const router = express.Router();

// API key authentication middleware
function authenticateApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ error: 'Missing X-API-Key header' });
    }

    const user = helpers.getUserByApiKey(apiKey);
    if (!user) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    req.apiUser = user;
    next();
}

router.use(authenticateApiKey);


// GET /api/v1/til/search?type=title|text|tag|date&q=searchterm
router.get('/til/search', function (req, res) {
    const searchtype = req.query.type;
    const search = req.query.q;

    if (!searchtype || !search) {
        return res.status(400).json({ error: 'type and q query parameters are required' });
    }

    if (!['title', 'text', 'tag', 'date'].includes(searchtype)) {
        return res.status(400).json({ error: 'type must be one of: title, text, tag, date' });
    }

    let rows;

    if (searchtype === 'title') {
        rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, GROUP_CONCAT(tags.tag) AS tags
            FROM tils JOIN tags_join ON tags_join.til_id = tils.id
            JOIN tags ON tags.id = tags_join.tag_id
            WHERE tils.user_id = ? AND tils.title LIKE ? GROUP BY tils.id`).all(req.apiUser.id, `%${search}%`);
    } else if (searchtype === 'text') {
        rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, GROUP_CONCAT(tags.tag) AS tags
            FROM tils JOIN tags_join ON tags_join.til_id = tils.id
            JOIN tags ON tags.id = tags_join.tag_id
            WHERE tils.user_id = ? AND tils.description LIKE ? GROUP BY tils.id`).all(req.apiUser.id, `%${search}%`);
    } else if (searchtype === 'date') {
        const range = helpers.getDateRange(new Date(search).getTime());
        rows = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, GROUP_CONCAT(tags.tag) AS tags
            FROM tils JOIN tags_join ON tags_join.til_id = tils.id
            JOIN tags ON tags.id = tags_join.tag_id
            WHERE tils.user_id = ? AND tils.date BETWEEN ? AND ? GROUP BY tils.id`).all(req.apiUser.id, range[0], range[1]);
    } else if (searchtype === 'tag') {
        rows = sqldb.prepare(`SELECT * FROM (
            SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, GROUP_CONCAT(tags.tag) AS tags
            FROM tils
            JOIN tags_join ON tags_join.til_id = tils.id
            JOIN tags ON tags.id = tags_join.tag_id
            WHERE tils.user_id = ?
            GROUP BY tils.id
            ) WHERE tags LIKE ? OR tags LIKE ? OR tags LIKE ?`).all(req.apiUser.id, `${search}`, `%${search},%`, `%,${search}`);
    }

    const results = (rows || []).map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        date: row.date,
        repetitions: row.repetitions,
        tags: row.tags ? row.tags.split(',') : []
    }));

    res.json({ count: results.length, results: results });
});


// GET /api/v1/til/:id - Retrieve a single TIL
router.get('/til/:id', function (req, res) {
    const row = sqldb.prepare(`SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions, GROUP_CONCAT(tags.tag) AS tags
        FROM tils
        JOIN tags_join ON tags_join.til_id = tils.id
        JOIN tags ON tags.id = tags_join.tag_id
        WHERE tils.user_id = ? AND tils.id = ?
        GROUP BY tils.id`).get(req.apiUser.id, req.params.id);

    if (!row) {
        return res.status(404).json({ error: 'TIL not found' });
    }

    res.json({
        id: row.id,
        title: row.title,
        description: row.description,
        date: row.date,
        repetitions: row.repetitions,
        tags: row.tags ? row.tags.split(',') : []
    });
});


// POST /api/v1/til - Create a new TIL
router.post('/til', function (req, res) {
    const { title, description, date } = req.body;

    if (!title || !description) {
        return res.status(400).json({ error: 'title and description are required' });
    }

    const tilDate = date ? new Date(date).getTime() : Date.now();

    let tags = parseHashtags(description);
    if (tags == null) {
        tags = ['#misc'];
    }

    const result = sqldb.prepare("INSERT INTO tils(user_id, title, description, date, repetitions) VALUES (?,?,?,?,?)")
        .run(req.apiUser.id, title, description, tilDate, 0);
    helpers.updateTags(result.lastInsertRowid, tags);

    res.status(201).json({
        id: Number(result.lastInsertRowid),
        title: title,
        description: description,
        date: tilDate,
        tags: tags
    });
});


module.exports = router;
