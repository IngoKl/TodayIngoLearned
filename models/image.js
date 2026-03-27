const sqldb = require('../db');

exports.getWithAccess = function (imageId) {
  return sqldb.prepare(`
    SELECT til_images.image_data, til_images.mime_type, til_images.filename,
           til_images.til_id, tils.user_id, tils.public AS is_public
    FROM til_images
    LEFT JOIN tils ON tils.id = til_images.til_id
    WHERE til_images.id = ?
  `).get(imageId);
};

exports.getOwnedOrOrphan = function (imageId, userId) {
  return sqldb.prepare(`
    SELECT til_images.id, til_images.til_id
    FROM til_images
    LEFT JOIN tils ON tils.id = til_images.til_id
    WHERE til_images.id = ? AND (tils.user_id = ? OR til_images.til_id IS NULL)
  `).get(imageId, userId);
};

exports.create = function (tilId, buffer, mimeType, filename) {
  return sqldb.prepare(
    'INSERT INTO til_images(til_id, image_data, mime_type, filename, created_at) VALUES (?,?,?,?,?)'
  ).run(tilId, buffer, mimeType, filename, Date.now());
};

exports.createForNote = function (buffer, mimeType, filename) {
  return sqldb.prepare(
    "INSERT INTO til_images(til_id, image_data, mime_type, filename, created_at, source) VALUES (NULL,?,?,?,?,'note')"
  ).run(buffer, mimeType, filename, Date.now());
};

exports.deleteById = function (imageId) {
  sqldb.prepare('DELETE FROM til_images WHERE id = ?').run(imageId);
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
