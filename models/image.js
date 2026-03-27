const sqldb = require('../db');

exports.getWithAccess = function (imageId) {
  return sqldb.prepare(`
    SELECT til_images.image_data, til_images.mime_type, til_images.filename,
           til_images.til_id, til_images.user_id AS owner_user_id,
           tils.user_id AS til_user_id, tils.public AS is_public, til_images.source
    FROM til_images
    LEFT JOIN tils ON tils.id = til_images.til_id
    WHERE til_images.id = ?
  `).get(imageId);
};

exports.getOwned = function (imageId, userId) {
  return sqldb.prepare(`
    SELECT til_images.id, til_images.til_id
    FROM til_images
    LEFT JOIN tils ON tils.id = til_images.til_id
    WHERE til_images.id = ?
      AND COALESCE(til_images.user_id, tils.user_id) = ?
  `).get(imageId, userId);
};

exports.create = function (userId, tilId, buffer, mimeType, filename) {
  return sqldb.prepare(
    'INSERT INTO til_images(user_id, til_id, image_data, mime_type, filename, created_at) VALUES (?,?,?,?,?,?)'
  ).run(userId, tilId, buffer, mimeType, filename, Date.now());
};

exports.createForNote = function (userId, buffer, mimeType, filename) {
  return sqldb.prepare(
    "INSERT INTO til_images(til_id, user_id, image_data, mime_type, filename, created_at, source) VALUES (NULL,?,?,?,?,?,'note')"
  ).run(userId, buffer, mimeType, filename, Date.now());
};

exports.deleteById = function (imageId) {
  sqldb.prepare('DELETE FROM til_images WHERE id = ?').run(imageId);
};

exports.deleteOwned = function (imageId, userId) {
  return sqldb.prepare('DELETE FROM til_images WHERE id = ? AND user_id = ?').run(imageId, userId);
};

exports.deleteByIdAndTil = function (imageId, tilId) {
  return sqldb.prepare('DELETE FROM til_images WHERE id = ? AND til_id = ?').run(imageId, tilId);
};

exports.listByTil = function (tilId) {
  return sqldb.prepare('SELECT id, filename, mime_type FROM til_images WHERE til_id = ?').all(tilId);
};

exports.listByTilDetailed = function (tilId) {
  return sqldb.prepare('SELECT id, filename, mime_type, created_at FROM til_images WHERE til_id = ?').all(tilId);
};
