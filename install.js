var db = require('./db');
var helpers = require('./helpers');
const fs = require('fs');

// Create a backup of the current database and rename it based on the current datetime
function backupDb() {
    // Backup old database
    if (fs.existsSync('./db/til.db')) {
        fs.renameSync('./db/til.db', `./db/til-${Date.now()}.db`);
    }
}

// Create a new database
function createDb() {
    backupDb();
    db.createdb.newDb();
}

// CLI
command = process.argv.slice(2)[0]
if (command == 'createdb') {
    createDb();
}
else if (command == 'populatedb') {
    db.createdb.populateDb();
}
else if (command == 'adduser') {
    helpers.addUser(process.argv.slice(2)[1], process.argv.slice(2)[2])
}
else if (command == 'setuserpassword') {
    helpers.changeUserPassword(process.argv.slice(2)[1], process.argv.slice(2)[2])
}
else {
    console.log('install.js createdb|populatedb|adduser|setuserpassword');
}