const express = require('express');
const dayjs = require('dayjs');
const helpers = require('./../../helpers');
const sqldb = require('./../../db');
const router = express.Router();


router.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const user_stats = helpers.getUserStats(req.user.id);
    const row = sqldb.prepare('SELECT api_key FROM users WHERE id = ?').get(req.user.id);
    const publicCount = sqldb.prepare('SELECT COUNT(*) AS count FROM tils WHERE user_id = ? AND public = 1').get(req.user.id).count;
    res.render('profile', { user: req.user, user_stats: user_stats, api_key: row.api_key || null, publicCount: publicCount });
  });


router.post('/api-key',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    helpers.generateApiKey(req.user.id);
    res.redirect('/user/profile');
  });


// Helper to fetch all TILs with tags for export
function getExportData(userId) {
  const rows = sqldb.prepare(`
    SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions,
           tils.last_repetition, tils.next_repetition, tils.public,
           GROUP_CONCAT(tags.tag) AS tags
    FROM tils
    LEFT JOIN tags_join ON tags_join.til_id = tils.id
    LEFT JOIN tags ON tags.id = tags_join.tag_id
    WHERE tils.user_id = ?
    GROUP BY tils.id
    ORDER BY tils.date DESC
  `).all(userId);

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    date: dayjs(row.date).format('YYYY-MM-DD'),
    tags: row.tags ? row.tags.split(',') : [],
    public: row.public === 1,
    repetitions: row.repetitions
  }));
}


// Export as JSON
router.get('/export/json',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const data = getExportData(req.user.id);
    const filename = `tils-export-${dayjs().format('YYYY-MM-DD')}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  });


// Export as CSV
router.get('/export/csv',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const data = getExportData(req.user.id);
    const filename = `tils-export-${dayjs().format('YYYY-MM-DD')}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');

    const escapeCsv = (val) => `"${String(val).replace(/"/g, '""')}"`;
    const header = 'id,title,description,date,tags,public,repetitions\n';
    const rows = data.map(row =>
      [row.id, escapeCsv(row.title), escapeCsv(row.description), row.date, escapeCsv(row.tags.join('; ')), row.public, row.repetitions].join(',')
    ).join('\n');

    res.send(header + rows);
  });


// Export as Markdown
router.get('/export/markdown',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const data = getExportData(req.user.id);
    const filename = `tils-export-${dayjs().format('YYYY-MM-DD')}.md`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');

    const md = data.map(row => {
      const tags = row.tags.length > 0 ? `Tags: ${row.tags.join(', ')}` : '';
      return `# ${row.title}\n\n**Date:** ${row.date}${tags ? '  \n**' + tags + '**' : ''}\n\n${row.description}\n\n---\n`;
    }).join('\n');

    res.send(md);
  });


module.exports = router;
