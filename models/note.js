const sqldb = require('../db');

// Boards
exports.listBoards = function (userId) {
  return sqldb.prepare('SELECT * FROM note_boards WHERE user_id = ? ORDER BY name ASC').all(userId);
};

exports.getBoard = function (boardId, userId) {
  return sqldb.prepare('SELECT * FROM note_boards WHERE id = ? AND user_id = ?').get(boardId, userId);
};

exports.createBoard = function (userId, name) {
  sqldb.prepare('INSERT INTO note_boards(user_id, name, created_at) VALUES (?,?,?)').run(userId, name, Date.now());
  return sqldb.prepare('SELECT id FROM note_boards WHERE user_id = ? AND name = ? ORDER BY id DESC').get(userId, name);
};

exports.renameBoard = function (boardId, userId, name) {
  sqldb.prepare('UPDATE note_boards SET name = ? WHERE id = ? AND user_id = ?').run(name, boardId, userId);
};

exports.deleteBoard = function (boardId, userId) {
  sqldb.prepare('UPDATE sticky_notes SET board_id = NULL WHERE board_id = ? AND user_id = ?').run(boardId, userId);
  sqldb.prepare('DELETE FROM note_boards WHERE id = ?').run(boardId);
};

// Notes
exports.listNotes = function (userId, boardId) {
  if (boardId) {
    return sqldb.prepare('SELECT * FROM sticky_notes WHERE user_id = ? AND board_id = ? ORDER BY z_index ASC').all(userId, boardId);
  }
  return sqldb.prepare('SELECT * FROM sticky_notes WHERE user_id = ? AND board_id IS NULL ORDER BY z_index ASC').all(userId);
};

exports.getNote = function (noteId, userId) {
  return sqldb.prepare('SELECT * FROM sticky_notes WHERE id = ? AND user_id = ?').get(noteId, userId);
};

exports.countNotes = function (userId, boardId) {
  if (boardId) {
    return sqldb.prepare('SELECT COUNT(*) AS c FROM sticky_notes WHERE user_id = ? AND board_id = ?').get(userId, boardId).c;
  }
  return sqldb.prepare('SELECT COUNT(*) AS c FROM sticky_notes WHERE user_id = ? AND board_id IS NULL').get(userId).c;
};

exports.maxZIndex = function (userId, boardId) {
  const row = boardId
    ? sqldb.prepare('SELECT MAX(z_index) AS m FROM sticky_notes WHERE user_id = ? AND board_id = ?').get(userId, boardId)
    : sqldb.prepare('SELECT MAX(z_index) AS m FROM sticky_notes WHERE user_id = ? AND board_id IS NULL').get(userId);
  return row.m || 0;
};

exports.createTextNote = function (userId, title, body, color, posX, posY, zIndex, boardId) {
  return sqldb.prepare(
    'INSERT INTO sticky_notes(user_id, title, body, type, color, pos_x, pos_y, z_index, board_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(userId, title, body, 'text', color, posX, posY, zIndex, boardId, Date.now(), Date.now());
};

exports.createDrawingNote = function (userId, imageId, color, posX, posY, zIndex, boardId) {
  return sqldb.prepare(
    'INSERT INTO sticky_notes(user_id, title, type, image_id, color, pos_x, pos_y, z_index, board_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).run(userId, 'Drawing', 'drawing', imageId, color, posX, posY, zIndex, boardId, Date.now(), Date.now());
};

exports.updateContent = function (noteId, userId, title, body, color) {
  sqldb.prepare(
    'UPDATE sticky_notes SET title = ?, body = ?, color = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(title, body, color, Date.now(), noteId, userId);
};

exports.updatePosition = function (noteId, userId, posX, posY, zIndex) {
  sqldb.prepare(
    'UPDATE sticky_notes SET pos_x = ?, pos_y = ?, z_index = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(posX, posY, zIndex, Date.now(), noteId, userId);
};

exports.moveToBoard = function (noteId, userId, boardId) {
  sqldb.prepare(
    'UPDATE sticky_notes SET board_id = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(boardId, Date.now(), noteId, userId);
};

exports.findEmptyNotes = function (userId, boardId) {
  const sql = boardId
    ? "SELECT id FROM sticky_notes WHERE user_id = ? AND board_id = ? AND type = 'text' AND (body IS NULL OR body = '') AND (title = 'New Note' OR title = '')"
    : "SELECT id FROM sticky_notes WHERE user_id = ? AND board_id IS NULL AND type = 'text' AND (body IS NULL OR body = '') AND (title = 'New Note' OR title = '')";
  return boardId
    ? sqldb.prepare(sql).all(userId, boardId)
    : sqldb.prepare(sql).all(userId);
};

exports.deleteNote = function (noteId, userId) {
  sqldb.prepare('DELETE FROM sticky_notes WHERE id = ? AND user_id = ?').run(noteId, userId);
};
