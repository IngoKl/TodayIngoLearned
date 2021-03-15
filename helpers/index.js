const sqlite3 = require('sqlite3').verbose();
var crypto = require('crypto');
var parseHashtags = require('parse-hashtags');

var config = require('../config.json');

/*Hashing passwords using SHA 256.
Be aware that SHA256, especially unsalted, should definitely not be used in 
production systems. */
exports.hashPassword = function(password) {
    var hash = crypto.createHash('sha256');
    hash.update(password);
    return hash.digest('hex');
}


// Return the id of the given tag. If the tag doesn't exist, it gets created.
exports.getAddTag = function(tag, callback) {
    let sqldb = new sqlite3.Database(config.dbpath)

    if (config.lowercasetags) {
      tag = tag.toLowerCase();
    }
  
    sqldb.get("SELECT * FROM tags where tag = ?", [tag], (err, row) => {
      if (row == null) {
        sqldb.run("INSERT INTO tags(tag) VALUES (?)", [tag], function (err) {
          if (err) {
            return console.log(err.message);
          }
  
          return callback(this.lastID)
        });
      } else {
        return callback(row.id);
      }
    });
  
}


// Add/Update the tags for a TIL
exports.updateTags = function(til_id, tags) {
    let sqldb = new sqlite3.Database(config.dbpath)

    // Delete all associations
    sqldb.run("DELETE FROM tags_join WHERE til_id = ?", til_id);
  
    // Create new associations
    tags.forEach(function(tag) {
  
      if (config.lowercasetags) {
        tag = tag.toLowerCase();
      }
  
      module.exports.getAddTag(tag, function (tag_id) {
        sqldb.run("INSERT INTO tags_join(til_id, tag_id) VALUES (?,?)", [til_id, tag_id], function (err) {
          if (err) {
            return console.log(err.message);
          }
        });
      });
    });
}


// Changing a user's password
exports.changeUserPassword = function(username, new_password) {
    let sqldb = new sqlite3.Database(config.dbpath)

    var hashed_password = this.hashPassword(new_password);    
    sqldb.run(`UPDATE users SET username = ?, password = ? WHERE username = ?`, [username, hashed_password, username]);
    sqldb.close()
}


// Creating a new user
exports.addUser = function(username, password) {
    let sqldb = new sqlite3.Database(config.dbpath)

    var hashed_password = this.hashPassword(password);    
    sqldb.run(`INSERT INTO users(username, password, displayname) VALUES (?,?,?)`, [username, hashed_password, username]);
    console.log(`New User Created: ${username}:${password}`);
    sqldb.close()
}


// Refreshing all tags
exports.refreshTags = function() {
    let sqldb = new sqlite3.Database(config.dbpath)

    sqldb.all(`SELECT * FROM tils`, (err, rows) => {
        rows.forEach(function(row){
            tags = parseHashtags(row.description);
            if (tags) {
                module.exports.updateTags(row.id, tags);
            }
        });
    });

}