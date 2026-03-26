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
    const boardId = req.query.board || null;

    const boards = sqldb.prepare(
      'SELECT * FROM note_boards WHERE user_id = ? ORDER BY name ASC'
    ).all(req.user.id);

    let notes;
    if (boardId) {
      notes = sqldb.prepare(
        'SELECT * FROM sticky_notes WHERE user_id = ? AND board_id = ? ORDER BY z_index ASC'
      ).all(req.user.id, boardId);
    } else {
      notes = sqldb.prepare(
        'SELECT * FROM sticky_notes WHERE user_id = ? AND board_id IS NULL ORDER BY z_index ASC'
      ).all(req.user.id);
    }

    // Load note colors from settings
    const noteColorsRow = sqldb.prepare("SELECT value FROM app_settings WHERE key = 'note_colors'").get();
    const noteColors = noteColorsRow ? noteColorsRow.value.split(',') : ['#fffffc', '#508991', '#fe5f55', '#0b1d51', '#1e2019'];

    res.render('notes', {
      notes: notes,
      boards: boards,
      currentBoard: boardId,
      noteColors: noteColors,
      user: req.user
    });
  });


// POST /notes/boards - Create a new board
router.post('/boards',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const name = (req.body.name || '').trim();
    if (!name) {
      return res.redirect('/notes');
    }

    sqldb.prepare(
      'INSERT INTO note_boards(user_id, name, created_at) VALUES (?,?,?)'
    ).run(req.user.id, name, Date.now());

    const board = sqldb.prepare(
      'SELECT id FROM note_boards WHERE user_id = ? AND name = ? ORDER BY id DESC'
    ).get(req.user.id, name);

    res.redirect('/notes?board=' + board.id);
  });


// POST /notes/boards/:id/rename - Rename a board
router.post('/boards/:id/rename',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const name = (req.body.name || '').trim();
    if (!name) return res.redirect('/notes');

    sqldb.prepare(
      'UPDATE note_boards SET name = ? WHERE id = ? AND user_id = ?'
    ).run(name, req.params.id, req.user.id);

    res.redirect('/notes?board=' + req.params.id);
  });


// GET /notes/boards/:id/delete - Delete a board (moves notes to unassigned)
router.get('/boards/:id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const board = sqldb.prepare('SELECT * FROM note_boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!board) return res.redirect('/notes');

    // Move notes from this board back to unassigned
    sqldb.prepare(
      'UPDATE sticky_notes SET board_id = NULL WHERE board_id = ? AND user_id = ?'
    ).run(req.params.id, req.user.id);

    sqldb.prepare('DELETE FROM note_boards WHERE id = ?').run(req.params.id);
    res.redirect('/notes');
  });


// POST /notes - Create a new text note
router.post('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const title = req.body.title || '';
    const body = req.body.body || '';
    const color = req.body.color || '#fffffc';
    const boardId = req.body.board_id || null;

    // Offset new notes slightly so they don't stack exactly
    const countQuery = boardId
      ? sqldb.prepare('SELECT COUNT(*) AS c FROM sticky_notes WHERE user_id = ? AND board_id = ?').get(req.user.id, boardId)
      : sqldb.prepare('SELECT COUNT(*) AS c FROM sticky_notes WHERE user_id = ? AND board_id IS NULL').get(req.user.id);
    const count = countQuery.c;
    const offset = (count % 10) * 30;

    const maxZQuery = boardId
      ? sqldb.prepare('SELECT MAX(z_index) AS m FROM sticky_notes WHERE user_id = ? AND board_id = ?').get(req.user.id, boardId)
      : sqldb.prepare('SELECT MAX(z_index) AS m FROM sticky_notes WHERE user_id = ? AND board_id IS NULL').get(req.user.id);
    const maxZ = maxZQuery.m || 0;

    const result = sqldb.prepare(
      'INSERT INTO sticky_notes(user_id, title, body, type, color, pos_x, pos_y, z_index, board_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(req.user.id, title, body, 'text', color, 50 + offset, 50 + offset, maxZ + 1, boardId, Date.now(), Date.now());

    if (req.accepts('json') && req.xhr) {
      return res.json({ success: true, id: Number(result.lastInsertRowid) });
    }
    const redirect = boardId ? '/notes?board=' + boardId : '/notes';
    res.redirect(redirect);
  });


// POST /notes/drawing - Create a new drawing note
router.post('/drawing',
  require('connect-ensure-login').ensureLoggedIn(),
  upload.single('image'),
  function (req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'No valid image file provided' });
    }

    const boardId = req.body.board_id || null;

    // Store image in til_images with source='note'
    const imgResult = sqldb.prepare(
      "INSERT INTO til_images(til_id, image_data, mime_type, filename, created_at, source) VALUES (NULL,?,?,?,?,'note')"
    ).run(req.file.buffer, req.file.mimetype, req.file.originalname, Date.now());

    const imageId = Number(imgResult.lastInsertRowid);

    const countQuery = boardId
      ? sqldb.prepare('SELECT COUNT(*) AS c FROM sticky_notes WHERE user_id = ? AND board_id = ?').get(req.user.id, boardId)
      : sqldb.prepare('SELECT COUNT(*) AS c FROM sticky_notes WHERE user_id = ? AND board_id IS NULL').get(req.user.id);
    const count = countQuery.c;
    const offset = (count % 10) * 30;

    const maxZQuery = boardId
      ? sqldb.prepare('SELECT MAX(z_index) AS m FROM sticky_notes WHERE user_id = ? AND board_id = ?').get(req.user.id, boardId)
      : sqldb.prepare('SELECT MAX(z_index) AS m FROM sticky_notes WHERE user_id = ? AND board_id IS NULL').get(req.user.id);
    const maxZ = maxZQuery.m || 0;

    const noteColorsRow = sqldb.prepare("SELECT value FROM app_settings WHERE key = 'note_colors'").get();
    const drawingColor = noteColorsRow ? noteColorsRow.value.split(',')[0] : '#fffffc';

    const result = sqldb.prepare(
      'INSERT INTO sticky_notes(user_id, title, type, image_id, color, pos_x, pos_y, z_index, board_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(req.user.id, 'Drawing', 'drawing', imageId, drawingColor, 50 + offset, 50 + offset, maxZ + 1, boardId, Date.now(), Date.now());

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


// POST /notes/:id/move - Move note to a different board
router.post('/:id/move',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res) {
    const boardId = req.body.board_id || null;

    sqldb.prepare(
      'UPDATE sticky_notes SET board_id = ?, updated_at = ? WHERE id = ? AND user_id = ?'
    ).run(boardId, Date.now(), req.params.id, req.user.id);

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

    const redirect = note.board_id ? '/notes?board=' + note.board_id : '/notes';
    res.redirect(redirect);
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
