const sqlite3 = require('sqlite3').verbose();
const config = require('./../config.json'); // Adjust the path as necessary
var sqldb = new sqlite3.Database(config.dbpath);

exports.createdb = require('./createdb');

module.exports = sqldb;