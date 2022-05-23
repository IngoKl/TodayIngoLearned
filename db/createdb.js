const sqlite3 = require('sqlite3').verbose();
var pwgenerator = require('generate-password');
var helpers = require('../helpers');


// Create a new SQLite database
exports.newDb = function () {
    // GG On a docker environment, refrain from uswing db directory
    if(helpers.isDatabasePresent()) {
        console.log("DB Already present");
    }
    let sqldb = new sqlite3.Database(helpers.getDBPath());

    sqldb.run('CREATE TABLE tils (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `user_id` INTEGER, `title` TEXT, `description` INTEGER, `date` INTEGER, `repetitions` INTEGER DEFAULT 0, `last_repetition` INTEGER DEFAULT 0, `next_repetition` INTEGER DEFAULT 0)');
    sqldb.run('CREATE TABLE tags (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `tag` TEXT UNIQUE)');
    sqldb.run('CREATE TABLE users (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `username` TEXT UNIQUE, `password` TEXT, `displayname` TEXT)');
    sqldb.run('CREATE TABLE tags_join (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `til_id` INTEGER, `tag_id` INTEGER)');
    sqldb.run('CREATE TABLE til_comments (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `til_id` INTEGER, `comment` TEXT,`user_id` INTEGER)');
    sqldb.run('CREATE TABLE bookmarks (`id` INTEGER PRIMARY KEY AUTOINCREMENT,`user_id` INTEGER,`til_id` INTEGER)');

    sqldb.close();
    console.log('New database created:'+helpers.getDBPath());
}

// Populate the database with some initial data
exports.populateDb = function () {
    let sqldb = new sqlite3.Database(helpers.getDBPath())

    // User
    var username = 'Ingo'
    var password = pwgenerator.generate({ length: 10, numbers: true });
    var hashed_password = helpers.hashPassword(password);
    sqldb.run(`INSERT INTO users(username, password, displayname) VALUES (?,?,?)`, [username, hashed_password, username]);
    console.log(`New User: ${username}:${password}`);

    // Tags
    sqldb.run(`INSERT INTO tags(tag) VALUES(?)`, ['#misc']);

    // TIL
    sqldb.run(`INSERT INTO tils(user_id, title, description, date) VALUES (?,?,?,?)`, [1, 'TodayIngoLearned', 'An app which helps you to remind what you learned.', Date.now()]);

    // Tag Join
    sqldb.run(`INSERT INTO tags_join(til_id, tag_id) VALUES(?,?)`, [1, 1]);

    sqldb.close()

    console.log('Databased ('+helpers.getDBPath()+') populated.');
}