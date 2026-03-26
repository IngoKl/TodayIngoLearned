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
      created_at INTEGER DEFAULT 0,
      source TEXT DEFAULT 'til'
    )`);
  }

  // Add source column to til_images
  const tilImageColumns = sqldb.pragma('table_info(til_images)').map(c => c.name);
  if (!tilImageColumns.includes('source')) {
    sqldb.exec("ALTER TABLE til_images ADD COLUMN source TEXT DEFAULT 'til'");
  }

  // Create sticky_notes table
  const stickyNotesTable = sqldb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sticky_notes'").get();
  if (!stickyNotesTable) {
    sqldb.exec(`CREATE TABLE sticky_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT DEFAULT '',
      body TEXT DEFAULT '',
      type TEXT NOT NULL DEFAULT 'text',
      image_id INTEGER DEFAULT NULL,
      color TEXT DEFAULT '#fff9c4',
      pos_x INTEGER DEFAULT 50,
      pos_y INTEGER DEFAULT 50,
      width INTEGER DEFAULT 200,
      height INTEGER DEFAULT 200,
      z_index INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT 0
    )`);
  }

  // Add board_id column to sticky_notes
  const stickyNoteColumns = sqldb.pragma('table_info(sticky_notes)').map(c => c.name);
  if (!stickyNoteColumns.includes('board_id')) {
    sqldb.exec('ALTER TABLE sticky_notes ADD COLUMN board_id INTEGER DEFAULT NULL');
  }

  // Create note_boards table
  const noteBoardsTable = sqldb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='note_boards'").get();
  if (!noteBoardsTable) {
    sqldb.exec(`CREATE TABLE note_boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER DEFAULT 0
    )`);
  }

  // Create app_settings table
  const appSettingsTable = sqldb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'").get();
  if (!appSettingsTable) {
    sqldb.exec(`CREATE TABLE app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    // Insert default values
    sqldb.prepare("INSERT INTO app_settings(key, value) VALUES (?, ?)").run('note_colors', '#fffffc,#508991,#fe5f55,#0b1d51,#1e2019');
    sqldb.prepare("INSERT INTO app_settings(key, value) VALUES (?, ?)").run('pen_colors', '#4ecdc4,#ffc145,#fffbff,#364652,#ca1551');
  }

  // Create FTS5 virtual table for full-text search
  const ftsTable = sqldb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tils_fts'").get();
  if (!ftsTable) {
    sqldb.exec(`CREATE VIRTUAL TABLE tils_fts USING fts5(title, description, content='tils', content_rowid='id')`);
    // Populate FTS index from existing data
    sqldb.exec(`INSERT INTO tils_fts(rowid, title, description) SELECT id, title, description FROM tils`);
  }
};
