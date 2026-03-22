const sqldb = require('./index');

module.exports = function () {
  // Add api_key column to users table
  const userColumns = sqldb.pragma('table_info(users)').map(c => c.name);
  if (!userColumns.includes('api_key')) {
    sqldb.exec('ALTER TABLE users ADD COLUMN api_key TEXT');
  }

  // Add public column to tils table
  const tilColumns = sqldb.pragma('table_info(tils)').map(c => c.name);
  if (!tilColumns.includes('public')) {
    sqldb.exec('ALTER TABLE tils ADD COLUMN public INTEGER DEFAULT 0');
  }

  // Add is_admin column to users table
  if (!userColumns.includes('is_admin')) {
    sqldb.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
  }

  // Create til_images table
  const tilImagesTable = sqldb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='til_images'").get();
  if (!tilImagesTable) {
    sqldb.exec(`CREATE TABLE til_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      til_id INTEGER,
      image_data BLOB NOT NULL,
      mime_type TEXT NOT NULL,
      filename TEXT,
      created_at INTEGER DEFAULT 0
    )`);
  }
};
