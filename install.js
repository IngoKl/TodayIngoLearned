var db = require('./db');
var helpers = require('./helpers');
const fs = require('fs');

var config = require('./config.json');

// Create a backup of the current database and rename it based on the current datetime
function backupDb(mode='copy') {
    // Backup old database
    if (fs.existsSync(config.dbpath)) {
        if (mode == 'copy') {
            fs.copyFile(config.dbpath, `./db/til-${Date.now()}.db`, (err) => { 
                if (err) { 
                  console.log("Error Found:", err); 
                }
            });
        } else if (mode == 'rename') {
            fs.renameSync(config.dbpath, `./db/til-${Date.now()}.db`);   
        }
    }
}

// Create a new database
function createDb() {
    backupDb('rename');
    db.createdb.newDb();
}

// Refresh the tags in a database
function refreshTags() {
    backupDb('copy');
    helpers.refreshTags();
}

// CLI
command = process.argv.slice(2)[0]
if (command == 'createdb') {
    createDb();
}
else if (command == 'populatedb') {
    db.createdb.populateDb();
}
else if (command == 'backupdb') {
    backupDb('copy');
}
else if (command == 'adduser') {
    helpers.addUser(process.argv.slice(2)[1], process.argv.slice(2)[2])
}
else if (command == 'setuserpassword') {
    helpers.changeUserPassword(process.argv.slice(2)[1], process.argv.slice(2)[2])
}
else if (command == 'refreshtags') {
    refreshTags();
}
else {
    console.log('install.js createdb|populatedb|backupdb|adduser|setuserpassword|refreshtags');
}