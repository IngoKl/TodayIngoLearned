const express = require('express');
const multer = require('multer');
const helpers = require('./../../helpers');
const parseHashtags = require('./../../helpers/parseHashtags');
const validate = require('./../../helpers/validate');
const NoteModel = require('./../../models/note');
const ImageModel = require('./../../models/image');
const Settings = require('./../../models/settings');
const TilModel = require('./../../models/til');
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
  function (req, res, next) {
    try {
      const boardId = req.query.board || null;
      const boards = NoteModel.listBoards(req.user.id);
      const notes = NoteModel.listNotes(req.user.id, boardId);
      const noteColors = Settings.getNoteColors();

      res.render('notes', {
        notes: notes,
        boards: boards,
        currentBoard: boardId,
        noteColors: noteColors,
        user: req.user
      });
    } catch (err) { next(err); }
  });


// POST /notes/boards - Create a new board
router.post('/boards',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const name = (req.body.name || '').trim();
      const check = validate.boardName(name);
      if (!check.valid) {
        return res.redirect('/notes');
      }

      const board = NoteModel.createBoard(req.user.id, name);
      res.redirect('/notes?board=' + board.id);
    } catch (err) { next(err); }
  });


// POST /notes/boards/:id/rename - Rename a board
router.post('/boards/:id/rename',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const name = (req.body.name || '').trim();
      const check = validate.boardName(name);
      if (!check.valid) return res.redirect('/notes');

      NoteModel.renameBoard(req.params.id, req.user.id, name);
      res.redirect('/notes?board=' + req.params.id);
    } catch (err) { next(err); }
  });


// POST /notes/boards/:id/delete - Delete a board (moves notes to unassigned)
router.post('/boards/:id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const board = NoteModel.getBoard(req.params.id, req.user.id);
      if (!board) return res.redirect('/notes');

      NoteModel.deleteBoard(req.params.id, req.user.id);
      res.redirect('/notes');
    } catch (err) { next(err); }
  });


// POST /notes - Create a new text note
router.post('/',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const check = validate.note(req.body);
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }

      const title = req.body.title || '';
      const body = req.body.body || '';
      const color = req.body.color || '#fffffc';
      const boardId = req.body.board_id || null;

      // Offset new notes slightly so they don't stack exactly
      const count = NoteModel.countNotes(req.user.id, boardId);
      const offset = (count % 10) * 30;
      const maxZ = NoteModel.maxZIndex(req.user.id, boardId);

      const result = NoteModel.createTextNote(req.user.id, title, body, color, 50 + offset, 50 + offset, maxZ + 1, boardId);

      if (req.accepts('json')) {
        return res.json({ success: true, id: Number(result.lastInsertRowid) });
      }
      const redirect = boardId ? '/notes?board=' + boardId : '/notes';
      res.redirect(redirect);
    } catch (err) { next(err); }
  });


// POST /notes/drawing - Create a new drawing note
router.post('/drawing',
  require('connect-ensure-login').ensureLoggedIn(),
  upload.single('image'),
  function (req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No valid image file provided' });
      }

      const boardId = req.body.board_id || null;

      // Store image in til_images with source='note'
      const imgResult = ImageModel.createForNote(req.file.buffer, req.file.mimetype, req.file.originalname);
      const imageId = Number(imgResult.lastInsertRowid);

      const count = NoteModel.countNotes(req.user.id, boardId);
      const offset = (count % 10) * 30;
      const maxZ = NoteModel.maxZIndex(req.user.id, boardId);

      const drawingColor = req.body.color || Settings.getNoteColors()[0];

      const result = NoteModel.createDrawingNote(req.user.id, imageId, drawingColor, 50 + offset, 50 + offset, maxZ + 1, boardId);

      res.json({ success: true, id: Number(result.lastInsertRowid), image_id: imageId });
    } catch (err) { next(err); }
  });


// POST /notes/delete-empty - Delete all empty text notes
router.post('/delete-empty',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const boardId = req.body.board_id || null;
      const emptyNotes = NoteModel.findEmptyNotes(req.user.id, boardId);
      const ids = emptyNotes.map(n => n.id);

      ids.forEach(id => NoteModel.deleteNote(id, req.user.id));

      res.json({ success: true, deleted: ids.length, ids: ids });
    } catch (err) { next(err); }
  });


// POST /notes/:id - Update note content
router.post('/:id',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const note = NoteModel.getNote(req.params.id, req.user.id);
      if (!note) return res.status(404).json({ error: 'Note not found' });

      const check = validate.note(req.body);
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }

      const title = req.body.title !== undefined ? req.body.title : note.title;
      const body = req.body.body !== undefined ? req.body.body : note.body;
      const color = req.body.color || note.color;

      NoteModel.updateContent(req.params.id, req.user.id, title, body, color);

      if (req.accepts('json')) {
        return res.json({ success: true });
      }
      res.redirect('/notes');
    } catch (err) { next(err); }
  });


// POST /notes/:id/position - Update note position (AJAX)
router.post('/:id/position',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const { pos_x, pos_y, z_index } = req.body;
      NoteModel.updatePosition(req.params.id, req.user.id, pos_x, pos_y, z_index);
      res.json({ success: true });
    } catch (err) { next(err); }
  });


// POST /notes/:id/move - Move note to a different board
router.post('/:id/move',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const boardId = req.body.board_id || null;
      NoteModel.moveToBoard(req.params.id, req.user.id, boardId);
      res.json({ success: true });
    } catch (err) { next(err); }
  });


// POST /notes/:id/delete - Delete a note
router.post('/:id/delete',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const note = NoteModel.getNote(req.params.id, req.user.id);
      if (!note) return res.status(404).send('Note not found');

      // Delete associated image if it's a drawing
      if (note.type === 'drawing' && note.image_id) {
        ImageModel.deleteById(note.image_id);
      }

      NoteModel.deleteNote(req.params.id, req.user.id);

      const redirect = note.board_id ? '/notes?board=' + note.board_id : '/notes';
      res.redirect(redirect);
    } catch (err) { next(err); }
  });


// POST /notes/:id/to-til - Convert a note to a TIL
router.post('/:id/to-til',
  require('connect-ensure-login').ensureLoggedIn(),
  function (req, res, next) {
    try {
      const note = NoteModel.getNote(req.params.id, req.user.id);
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

      const result = TilModel.create(req.user.id, title, description, date);
      helpers.updateTags(result.lastInsertRowid, parsedTags);

      // For drawing notes, associate the image with the new TIL
      if (note.type === 'drawing' && note.image_id) {
        const sqldb = require('./../../db');
        sqldb.prepare("UPDATE til_images SET til_id = ?, source = 'til' WHERE id = ?")
          .run(result.lastInsertRowid, note.image_id);
      }

      // Delete the sticky note (image is now owned by the TIL)
      NoteModel.deleteNote(req.params.id, req.user.id);

      res.redirect(`/til/view/${result.lastInsertRowid}`);
    } catch (err) { next(err); }
  });


module.exports = router;
