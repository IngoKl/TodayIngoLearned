const Database = require('better-sqlite3');
const pwgenerator = require('generate-password');
const helpers = require('./../helpers');
const config = require('./../config.json');


// Create a new SQLite database
exports.newDb = function () {
    const sqldb = new Database(config.dbpath);

    // Date convention: `date` stores milliseconds (Date.now()); `last_repetition`/`next_repetition` store Unix seconds
    sqldb.exec('CREATE TABLE tils (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `user_id` INTEGER, `title` TEXT, `description` TEXT, `date` INTEGER, `repetitions` INTEGER DEFAULT 0, `last_repetition` INTEGER DEFAULT 0, `next_repetition` INTEGER DEFAULT 0, `public` INTEGER DEFAULT 0)');
    sqldb.exec('CREATE TABLE tags (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `tag` TEXT UNIQUE)');
    sqldb.exec('CREATE TABLE users (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `username` TEXT UNIQUE, `password` TEXT, `displayname` TEXT, `is_admin` INTEGER DEFAULT 0)');
    sqldb.exec('CREATE TABLE tags_join (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `til_id` INTEGER, `tag_id` INTEGER)');
    sqldb.exec('CREATE TABLE til_comments (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `til_id` INTEGER, `comment` TEXT,`user_id` INTEGER)');
    sqldb.exec('CREATE TABLE bookmarks (`id` INTEGER PRIMARY KEY AUTOINCREMENT,`user_id` INTEGER,`til_id` INTEGER)');
    sqldb.exec('CREATE TABLE til_images (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `til_id` INTEGER, `user_id` INTEGER, `image_data` BLOB NOT NULL, `mime_type` TEXT NOT NULL, `filename` TEXT, `created_at` INTEGER DEFAULT 0, `source` TEXT DEFAULT \'til\')');
    sqldb.exec('CREATE TABLE sticky_notes (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `user_id` INTEGER NOT NULL, `title` TEXT DEFAULT \'\', `body` TEXT DEFAULT \'\', `type` TEXT NOT NULL DEFAULT \'text\', `image_id` INTEGER DEFAULT NULL, `color` TEXT DEFAULT \'#fff9c4\', `pos_x` INTEGER DEFAULT 50, `pos_y` INTEGER DEFAULT 50, `width` INTEGER DEFAULT 200, `height` INTEGER DEFAULT 200, `z_index` INTEGER DEFAULT 0, `board_id` INTEGER DEFAULT NULL, `created_at` INTEGER DEFAULT 0, `updated_at` INTEGER DEFAULT 0)');
    sqldb.exec('CREATE TABLE note_boards (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `user_id` INTEGER NOT NULL, `name` TEXT NOT NULL, `created_at` INTEGER DEFAULT 0)');
    sqldb.exec('CREATE TABLE app_settings (`key` TEXT PRIMARY KEY, `value` TEXT NOT NULL)');
    sqldb.exec("INSERT INTO app_settings(key, value) VALUES ('note_colors', '#fffffc,#508991,#fe5f55,#0b1d51,#1e2019')");
    sqldb.exec("INSERT INTO app_settings(key, value) VALUES ('pen_colors', '#4ecdc4,#ffc145,#fffbff,#364652,#ca1551')");

    // Full-text search index (FTS5)
    sqldb.exec(`CREATE VIRTUAL TABLE tils_fts USING fts5(title, description, content='tils', content_rowid='id')`);

    sqldb.close();
    console.log('New database created ' + config.dbpath);
}

// Populate the database with some initial data
exports.populateDb = function () {
    const sqldb = new Database(config.dbpath);

    // User
    const username = 'Ingo';
    const password = pwgenerator.generate({ length: 10, numbers: true });
    const hashed_password = helpers.hashPassword(password);
    sqldb.prepare('INSERT INTO users(username, password, displayname) VALUES (?,?,?)').run(username, hashed_password, username);
    console.log(`New User: ${username}:${password}`);

    // Tags
    sqldb.prepare('INSERT INTO tags(tag) VALUES(?)').run('#misc');

    // TIL
    sqldb.prepare('INSERT INTO tils(user_id, title, description, date) VALUES (?,?,?,?)').run(1, 'TodayIngoLearned', 'An app which helps you to remind what you learned.', Date.now());

    // Tag Join
    sqldb.prepare('INSERT INTO tags_join(til_id, tag_id) VALUES(?,?)').run(1, 1);

    sqldb.close();

    console.log('Database ' + config.dbpath + ' populated.');
}
