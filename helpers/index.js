const sqlite3 = require('sqlite3').verbose();
var crypto = require('crypto');
var moment = require('moment');
var sqldb = require('./../db');
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
    var hashed_password = this.hashPassword(new_password);    
    sqldb.run(`UPDATE users SET username = ?, password = ? WHERE username = ?`, [username, hashed_password, username]);
    sqldb.close()
}


// Creating a new user
exports.addUser = function(username, password) {
    var hashed_password = this.hashPassword(password);    
    sqldb.run(`INSERT INTO users(username, password, displayname) VALUES (?,?,?)`, [username, hashed_password, username]);
    console.log(`New User Created: ${username}:${password}`);
    sqldb.close()
}

// List all users
exports.listUsers = function(callback) {
    sqldb.all(`SELECT * FROM users`, (err, rows) => {
      for (var i = 0; i < rows.length; i++) {
        console.log(rows[i].username);
      }
    });
}

// Refreshing all tags
exports.refreshTags = function() {
    sqldb.all(`SELECT * FROM tils`, (err, rows) => {
        rows.forEach(function(row){
            tags = parseHashtags(row.description);
            if (tags) {
                module.exports.updateTags(row.id, tags);
            }
        });
    });
}

// Show a TIL based on its id
exports.showTil = function(id) {
    sqldb.get(`SELECT * FROM tils WHERE id = ?`, [id], (err, row) => {
      if (row) {
        console.log(row.title + "\n" + row.description);
      } else {
        console.log("TIL not found");
      }
    });
}


// Get all tags used by a specific user based on their id
exports.getUserTags = function(user_id, callback) {
    sqldb.all(`SELECT tags.tag FROM tags JOIN tags_join ON tags.id = tags_join.tag_id JOIN tils ON tils.id = tags_join.til_id WHERE tils.user_id = ?`, [user_id], (err, rows) => {
      var tags = [];
      rows.forEach(function (tag) {
        if (config.lowercasetags) {
          tags.push(tag.tag.toLowerCase());
        } else {
          tags.push(tag.tag)
        }
      });
      return callback(tags);
    });
}


// Get number of TILs and number of unique tags for a specific user based on their id
exports.getUserStats = function(user_id) {
  return new Promise((resolve, reject) => {
      sqldb.get(`SELECT COUNT(*) as count FROM tils WHERE user_id = ?`, [user_id], (err, firstQueryResult) => {
          if (err) {
              sqldb.close();
              reject(err);
          } else {
              var count = firstQueryResult.count;
              sqldb.get(`SELECT COUNT(DISTINCT tag_id) as count FROM tags_join JOIN tils ON tils.id = tags_join.til_id WHERE tils.user_id = ?`, [user_id], (err, secondQueryResult) => {
                  sqldb.close();
                  if (err) {
                      reject(err);
                  } else {
                      var unique_tags = secondQueryResult.count;
                      resolve({'tils': count, 'unique_tags': unique_tags});
                  }
              });
          }
      });
  });
}

// Get the start/end timestamp of a given day
exports.getDateRange = function(timestamp) {
  start_date = moment(timestamp).startOf('day').valueOf();
  end_date = moment(timestamp).endOf('day').valueOf();

  return [start_date, end_date];
}