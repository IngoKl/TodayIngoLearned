const sqlite3 = require('sqlite3').verbose();
var crypto = require('crypto');

/*Hashing passwords using SHA 256.
Be aware that SHA256, especially unsalted, should definitely not be used in 
production systems. */
exports.hashPassword = function(password) {
    var hash = crypto.createHash('sha256');
    hash.update(password);
    return hash.digest('hex');
}

// Changing a user's password
exports.changeUserPassword = function(username, new_password) {
    let sqldb = new sqlite3.Database('./db/til.db')

    var hashed_password = this.hashPassword(new_password);    
    sqldb.run(`UPDATE users SET username = ?, password = ? WHERE username = ?`, [username, hashed_password, username]);
    sqldb.close()
}

// Creating a new user
exports.addUser = function(username, password) {
    let sqldb = new sqlite3.Database('./db/til.db')

    var hashed_password = this.hashPassword(password);    
    sqldb.run(`INSERT INTO users(username, password, displayname) VALUES (?,?,?)`, [username, hashed_password, username]);
    console.log(`New User Created: ${username}:${password}`);
    sqldb.close()
}