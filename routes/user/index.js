const express = require('express');
const dayjs = require('dayjs');
const helpers = require('./../../helpers');
const TilModel = require('./../../models/til');
const UserModel = require('./../../models/user');
const router = express.Router();


router.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const user_stats = helpers.getUserStats(req.user.id);
      const api_key = UserModel.getApiKey(req.user.id);
      const publicCount = UserModel.getPublicTilCount(req.user.id);
      res.render('profile', { user: req.user, user_stats: user_stats, api_key: api_key, publicCount: publicCount });
    } catch (err) { next(err); }
  });


router.post('/api-key',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      helpers.generateApiKey(req.user.id);
      res.redirect('/user/profile');
    } catch (err) { next(err); }
  });


// Helper to fetch all TILs with tags for export
function getExportData(userId) {
  const rows = TilModel.getExportData(userId);
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
  function (req, res, next) {
    try {
      const data = getExportData(req.user.id);
      const filename = `tils-export-${dayjs().format('YYYY-MM-DD')}.json`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(data, null, 2));
    } catch (err) { next(err); }
  });


// Export as CSV
router.get('/export/csv',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const data = getExportData(req.user.id);
      const filename = `tils-export-${dayjs().format('YYYY-MM-DD')}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');

      const escapeCsv = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const header = 'id,title,description,date,tags,public,repetitions\n';
      const rows = data.map(row =>
        [row.id, escapeCsv(row.title), escapeCsv(row.description), row.date, escapeCsv(row.tags.join('; ')), row.public, row.repetitions].join(',')
      ).join('\n');

      res.send(header + rows);
    } catch (err) { next(err); }
  });


// Export as Markdown
router.get('/export/markdown',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const data = getExportData(req.user.id);
      const filename = `tils-export-${dayjs().format('YYYY-MM-DD')}.md`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');

      const md = data.map(row => {
        const tags = row.tags.length > 0 ? `Tags: ${row.tags.join(', ')}` : '';
        return `# ${row.title}\n\n**Date:** ${row.date}${tags ? '  \n**' + tags + '**' : ''}\n\n${row.description}\n\n---\n`;
      }).join('\n');

      res.send(md);
    } catch (err) { next(err); }
  });


module.exports = router;
