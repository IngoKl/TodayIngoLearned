const sqldb = require('../db');

exports.getById = function (userId, commentId) {
  return sqldb.prepare('SELECT * FROM til_comments WHERE id = ? AND user_id = ?').get(commentId, userId);
};

exports.listByTil = function (tilId, userId) {
  return sqldb.prepare('SELECT * FROM til_comments WHERE til_id = ? AND user_id = ?').all(tilId, userId);
};

exports.create = function (userId, tilId, comment) {
  return sqldb.prepare('INSERT INTO til_comments(user_id, til_id, comment) VALUES (?,?,?)').run(userId, tilId, comment);
};

exports.update = function (userId, commentId, comment) {
  return sqldb.prepare('UPDATE til_comments SET comment = ? WHERE id = ? AND user_id = ?').run(comment, commentId, userId);
};

exports.deleteById = function (userId, commentId) {
  return sqldb.prepare('DELETE FROM til_comments WHERE id = ? AND user_id = ?').run(commentId, userId);
};
