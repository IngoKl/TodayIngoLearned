const fs = require('fs');

const config = require('./config');

function getCreate() {
    return require('./db/create');
}

function getHelpers() {
    return require('./helpers');
}

// Create a backup of the current database and rename it based on the current datetime
function backupDb(mode='copy') {
    // Backup old database
    if (fs.existsSync(config.dbpath)) {
        const backupPath = `./db/til-${Date.now()}.db`;
        if (mode === 'copy') {
            fs.copyFile(config.dbpath, backupPath, (err) => {
                if (err) {
                  console.log("Error Found:", err);
                } else {
                  console.log(`Database backed up to ${backupPath}`);
                }
            });
        } else if (mode === 'rename') {
            fs.renameSync(config.dbpath, backupPath);
            console.log(`Database renamed to ${backupPath}`);
        }
    } else {
        console.log('No database found to back up.');
    }
}

// Create a new database
function createDb() {
    backupDb('rename');
    getCreate().newDb();
}

// Refresh the tags in a database
function refreshTags() {
    backupDb('copy');
    getHelpers().refreshTags();
}

// CLI
const command = process.argv.slice(2)[0];
if (command === 'createdb') {
    createDb();
}
else if (command === 'populatedb') {
    getCreate().populateDb();
}
else if (command === 'backupdb') {
    backupDb('copy');
}
else if (command === 'adduser') {
    getHelpers().addUser(process.argv.slice(2)[1], process.argv.slice(2)[2]);
}
else if (command === 'setuserpassword') {
    getHelpers().changeUserPassword(process.argv.slice(2)[1], process.argv.slice(2)[2]);
}
else if (command === 'listusers') {
    getHelpers().listUsers();
}
else if (command === 'refreshtags') {
    refreshTags();
}
else if (command === 'showtil') {
    getHelpers().showTil(process.argv.slice(2)[1] || 1);
}
else if (command === 'generatetils') {
    const count = parseInt(process.argv.slice(2)[1]) || 10;
    getHelpers().generateRandomTils(count);
}
else if (command === 'fixnulldates') {
    getHelpers().fixNullDates();
}
else if (command === 'setadmin') {
    getHelpers().setAdmin(process.argv.slice(2)[1], true);
}
else if (command === 'removeadmin') {
    getHelpers().setAdmin(process.argv.slice(2)[1], false);
}
else if (command === 'rebuildfts') {
    getHelpers().rebuildFts();
}
else {
    console.log('install.js createdb|populatedb|backupdb|adduser|listusers|setuserpassword|refreshtags|rebuildfts|showtil|generatetils|fixnulldates|setadmin|removeadmin');
}
