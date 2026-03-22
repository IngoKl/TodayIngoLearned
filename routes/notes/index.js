const express = require('express');
const multer = require('multer');
const sqldb = require('./../../db');
const helpers = require('./../../helpers');
const parseHashtags = require('./../../helpers/parseHashtags');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});


// GET /notes - Render the notes board
router.get('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const notes = sqldb.prepare(
      'SELECT * FROM sticky_notes WHERE user_id = ? ORDER BY z_index ASC'
    ).all(req.user.id);

    res.render('notes', { notes: notes, user: req.user });
  });


// POST /notes - Create a new text note
router.post('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const title = req.body.title || '';
    const body = req.body.body || '';
    const color = req.body.color || '#fff9c4';

    // Offset new notes slightly so they don't stack exactly
    const count = sqldb.prepare('SELECT COUNT(*) AS c FROM sticky_notes WHERE user_id = ?').get(req.user.id).c;
    const offset = (count % 10) * 30;

    const maxZ = sqldb.prepare('SELECT MAX(z_index) AS m FROM sticky_notes WHERE user_id = ?').get(req.user.id).m || 0;

    const result = sqldb.prepare(
      'INSERT INTO sticky_notes(user_id, title, body, type, color, pos_x, pos_y, z_index, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(req.user.id, title, body, 'text', color, 50 + offset, 50 + offset, maxZ + 1, Date.now(), Date.now());

    if (req.accepts('json') && req.xhr) {
      return res.json({ success: true, id: Number(result.lastInsertRowid) });
    }
    res.redirect('/notes');
  });


// POST /notes/drawing - Create a new drawing note
router.post('/drawing',
  require('connect-ensure-login').ensureLoggedIn(),
  upload.single('image'),
  function (req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'No valid image file provided' });
    }

    // Store image in til_images with source='note'
    const imgResult = sqldb.prepare(
      "INSERT INTO til_images(til_id, image_data, mime_type, filename, created_at, source) VALUES (NULL,?,?,?,?,'note')"
    ).run(req.file.buffer, req.file.mimetype, req.file.originalname, Date.now());

    const imageId = Number(imgResult.lastInsertRowid);

    const count = sqldb.prepare('SELECT COUNT(*) AS c FROM sticky_notes WHERE user_id = ?').get(req.user.id).c;
    const offset = (count % 10) * 30;
    const maxZ = sqldb.prepare('SELECT MAX(z_index) AS m FROM sticky_notes WHERE user_id = ?').get(req.user.id).m || 0;

    const result = sqldb.prepare(
      'INSERT INTO sticky_notes(user_id, title, type, image_id, color, pos_x, pos_y, z_index, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).run(req.user.id, 'Drawing', 'drawing', imageId, '#fff9c4', 50 + offset, 50 + offset, maxZ + 1, Date.now(), Date.now());

    res.json({ success: true, id: Number(result.lastInsertRowid), image_id: imageId });
  });


// POST /notes/:id - Update note content
router.post('/:id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const note = sqldb.prepare('SELECT * FROM sticky_notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const title = req.body.title !== undefined ? req.body.title : note.title;
    const body = req.body.body !== undefined ? req.body.body : note.body;
    const color = req.body.color || note.color;

    sqldb.prepare(
      'UPDATE sticky_notes SET title = ?, body = ?, color = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).run(title, body, color, Date.now(), req.params.id, req.user.id);

    if (req.accepts('json')) {
      return res.json({ success: true });
    }
    res.redirect('/notes');
  });


// POST /notes/:id/position - Update note position (AJAX)
router.post('/:id/position',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const { pos_x, pos_y, z_index } = req.body;

    sqldb.prepare(
      'UPDATE sticky_notes SET pos_x = ?, pos_y = ?, z_index = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).run(pos_x, pos_y, z_index, Date.now(), req.params.id, req.user.id);

    res.json({ success: true });
  });


// GET /notes/:id/delete - Delete a note
router.get('/:id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const note = sqldb.prepare('SELECT * FROM sticky_notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!note) return res.status(404).send('Note not found');

    // Delete associated image if it's a drawing
    if (note.type === 'drawing' && note.image_id) {
      sqldb.prepare('DELETE FROM til_images WHERE id = ?').run(note.image_id);
    }

    sqldb.prepare('DELETE FROM sticky_notes WHERE id = ?').run(req.params.id);
    res.redirect('/notes');
  });


// POST /notes/:id/to-til - Convert a note to a TIL
router.post('/:id/to-til',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const note = sqldb.prepare('SELECT * FROM sticky_notes WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!note) return res.status(404).send('Note not found');

    const title = note.title || 'Untitled Note';
    const date = new Date(req.body.date || Date.now()).getTime();
    const tags = req.body.tags || '#misc';

    let description;
    if (note.type === 'drawing' && note.image_id) {
      description = `![drawing](/image/${note.image_id})\n\nTags: ${tags}`;
    } else {
      description = note.body ? `${note.body}\n\nTags: ${tags}` : `Tags: ${tags}`;
    }

    const parsedTags = parseHashtags(description) || ['#misc'];

    const result = sqldb.prepare(
      'INSERT INTO tils(user_id, title, description, date, repetitions) VALUES (?,?,?,?,?)'
    ).run(req.user.id, title, description, date, 0);

    helpers.updateTags(result.lastInsertRowid, parsedTags);

    // For drawing notes, associate the image with the new TIL
    if (note.type === 'drawing' && note.image_id) {
      sqldb.prepare("UPDATE til_images SET til_id = ?, source = 'til' WHERE id = ?")
        .run(result.lastInsertRowid, note.image_id);
    }

    // Delete the sticky note (image is now owned by the TIL)
    sqldb.prepare('DELETE FROM sticky_notes WHERE id = ?').run(req.params.id);

    res.redirect(`/til/view/${result.lastInsertRowid}`);
  });


module.exports = router;
