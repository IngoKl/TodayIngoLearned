const sqldb = require('../db');

exports.getByUsername = function (username) {
  return sqldb.prepare('SELECT id, username, password FROM users WHERE username = ?').get(username);
};

exports.getById = function (id) {
  return sqldb.prepare('SELECT id, username, is_admin FROM users WHERE id = ?').get(id);
};

exports.getDisplayName = function (userId) {
  const row = sqldb.prepare('SELECT displayname FROM users WHERE id = ?').get(userId);
  return row ? row.displayname : null;
};

exports.getIdAndDisplayName = function (userId) {
  return sqldb.prepare('SELECT id, displayname FROM users WHERE id = ?').get(userId);
};

exports.getApiKey = function (userId) {
  const row = sqldb.prepare('SELECT api_key FROM users WHERE id = ?').get(userId);
  return row ? row.api_key : null;
};

exports.updatePassword = function (userId, hashedPassword) {
  sqldb.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, userId);
};

exports.existsByUsername = function (username) {
  return !!sqldb.prepare('SELECT id FROM users WHERE username = ?').get(username);
};

exports.create = function (username, hashedPassword, displayname) {
  sqldb.prepare('INSERT INTO users(username, password, displayname) VALUES (?,?,?)').run(username, hashedPassword, displayname || username);
};

exports.listWithStats = function () {
  return sqldb.prepare(`
    SELECT
      u.id, u.username, u.displayname, u.is_admin,
      (SELECT COUNT(*) FROM tils WHERE user_id = u.id) AS tils_count,
      (SELECT COUNT(DISTINCT tag_id) FROM tags_join JOIN tils ON tils.id = tags_join.til_id WHERE tils.user_id = u.id) AS tags_count,
      (SELECT COUNT(*) FROM bookmarks WHERE user_id = u.id) AS bookmarks_count,
      (SELECT COUNT(*) FROM til_comments WHERE user_id = u.id) AS comments_count
    FROM users u
    ORDER BY u.id ASC
  `).all();
};

exports.getPublicTilCount = function (userId) {
  return sqldb.prepare('SELECT COUNT(*) AS count FROM tils WHERE user_id = ? AND public = 1').get(userId).count;
};
