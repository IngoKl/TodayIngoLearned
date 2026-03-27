const sqldb = require('../db');
const { TIL_BASE_QUERY } = require('../helpers/queries');

exports.exists = function (userId, tilId) {
  return !!sqldb.prepare('SELECT * FROM bookmarks WHERE til_id = ? AND user_id = ?').get(tilId, userId);
};

exports.toggle = function (userId, tilId) {
  const row = sqldb.prepare('SELECT * FROM bookmarks WHERE til_id = ? AND user_id = ?').get(tilId, userId);
  if (row) {
    sqldb.prepare('DELETE FROM bookmarks WHERE til_id = ? AND user_id = ?').run(tilId, userId);
  } else {
    sqldb.prepare('INSERT INTO bookmarks(user_id, til_id) VALUES (?,?)').run(userId, tilId);
  }
};

exports.listAll = function (userId) {
  return sqldb.prepare(`${TIL_BASE_QUERY}
    JOIN bookmarks ON bookmarks.til_id = tils.id
    WHERE bookmarks.user_id = ? GROUP BY tils.id`).all(userId);
};
