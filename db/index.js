const Database = require('better-sqlite3');
const config = require('./../config.json');
const sqldb = new Database(config.dbpath);

// Enable WAL mode for better concurrent read performance
sqldb.pragma('journal_mode = WAL');

module.exports = sqldb;
