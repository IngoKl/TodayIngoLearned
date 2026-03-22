const crypto = require('crypto');
const dayjs = require('dayjs');
const sqldb = require('./../db');
const parseHashtags = require('./parseHashtags');

const config = require('../config.json');

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_LEN = 16;

/*
  Password hashing using scrypt (Node.js built-in).
  Returns a string in the format "scrypt:<salt_hex>:<hash_hex>".
  Legacy SHA-256 hashes (plain hex) are detected on login and upgraded.
*/
exports.hashPassword = function(password) {
    const salt = crypto.randomBytes(SCRYPT_SALT_LEN);
    const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

// Verify a password against a stored hash (supports both scrypt and legacy SHA-256)
exports.verifyPassword = function(password, storedHash) {
    if (storedHash.startsWith('scrypt:')) {
        const parts = storedHash.split(':');
        const salt = Buffer.from(parts[1], 'hex');
        const hash = Buffer.from(parts[2], 'hex');
        const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
        return crypto.timingSafeEqual(hash, derived);
    }
    // Legacy SHA-256 fallback
    const sha256 = crypto.createHash('sha256').update(password).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sha256, 'hex'), Buffer.from(storedHash, 'hex'));
}

// Check if a stored hash uses the legacy SHA-256 format
exports.isLegacyHash = function(storedHash) {
    return !storedHash.startsWith('scrypt:');
}


// Return whether a TIL is bookmarked by a user
exports.isBookmarked = function(user_id, til_id) {
    const row = sqldb.prepare("SELECT COUNT(*) AS count FROM bookmarks WHERE user_id = ? AND til_id = ?").get(user_id, til_id);
    return row.count === 1;
}

// Return the id of the given tag. If the tag doesn't exist, it gets created.
exports.getAddTag = function(tag) {
    if (config.lowercasetags) {
      tag = tag.toLowerCase();
    }

    const row = sqldb.prepare("SELECT * FROM tags WHERE tag = ?").get(tag);
    if (!row) {
        const result = sqldb.prepare("INSERT INTO tags(tag) VALUES (?)").run(tag);
        return result.lastInsertRowid;
    }
    return row.id;
}


// Add/Update the tags for a TIL
exports.updateTags = function(til_id, tags) {
    // Delete all associations
    sqldb.prepare("DELETE FROM tags_join WHERE til_id = ?").run(til_id);

    // Create new associations
    const insertStmt = sqldb.prepare("INSERT INTO tags_join(til_id, tag_id) VALUES (?,?)");
    for (const tag of tags) {
        const tag_id = module.exports.getAddTag(tag);
        insertStmt.run(til_id, tag_id);
    }
}


// Changing a user's password
exports.changeUserPassword = function(username, new_password) {
    const hashed_password = this.hashPassword(new_password);
    sqldb.prepare('UPDATE users SET password = ? WHERE username = ?').run(hashed_password, username);
}


// Creating a new user
exports.addUser = function(username, password) {
    const hashed_password = this.hashPassword(password);
    sqldb.prepare('INSERT INTO users(username, password, displayname) VALUES (?,?,?)').run(username, hashed_password, username);
    console.log(`New User Created: ${username}`);
}

// List all users
exports.listUsers = function() {
    const rows = sqldb.prepare('SELECT * FROM users').all();
    for (const row of rows) {
        console.log(row.username);
    }
}

// Set or remove admin status for a user
exports.setAdmin = function(username, isAdmin) {
    const result = sqldb.prepare('UPDATE users SET is_admin = ? WHERE username = ?').run(isAdmin ? 1 : 0, username);
    if (result.changes === 0) {
        console.log(`User not found: ${username}`);
    } else {
        console.log(`${username} is ${isAdmin ? 'now' : 'no longer'} an admin`);
    }
}

// Refreshing all tags
exports.refreshTags = function() {
    const rows = sqldb.prepare('SELECT * FROM tils').all();
    for (const row of rows) {
        const tags = parseHashtags(row.description);
        if (tags) {
            module.exports.updateTags(row.id, tags);
        }
    }
}


// Show a TIL based on its id
exports.showTil = function(id) {
    const row = sqldb.prepare('SELECT * FROM tils WHERE id = ?').get(id);
    if (row) {
        console.log(row.title + "\n" + row.description);
    } else {
        console.log("TIL not found");
    }
}


// Get all tags used by a specific user based on their id
exports.getUserTags = function(user_id) {
    const rows = sqldb.prepare('SELECT tags.tag FROM tags JOIN tags_join ON tags.id = tags_join.tag_id JOIN tils ON tils.id = tags_join.til_id WHERE tils.user_id = ?').all(user_id);
    const tags = rows.map(row => config.lowercasetags ? row.tag.toLowerCase() : row.tag);
    return tags;
}


// Get number of TILs and number of unique tags for a specific user based on their id
exports.getUserStats = function(user_id) {
    const sql = `
      SELECT
        (SELECT COUNT(*) FROM tils WHERE user_id = ?) AS tils_count,
        (SELECT COUNT(DISTINCT tag_id) FROM tags_join JOIN tils ON tils.id = tags_join.til_id WHERE tils.user_id = ?) AS unique_tags_count,
        (SELECT COUNT(*) FROM bookmarks WHERE user_id = ?) AS bookmarks_count
    `;
    const result = sqldb.prepare(sql).get(user_id, user_id, user_id);
    return {
        tils: result.tils_count,
        unique_tags: result.unique_tags_count,
        bookmarks: result.bookmarks_count
    };
}


// Get the start/end timestamp of a given day
exports.getDateRange = function(timestamp) {
    const start_date = dayjs(timestamp).startOf('day').valueOf();
    const end_date = dayjs(timestamp).endOf('day').valueOf();
    return [start_date, end_date];
}

// Generate random TILs for testing
exports.generateRandomTils = function(count) {
    const loremIpsum = [
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
        "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
        "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
        "Excepteur sint occaecat cupidatat non proident, sunt in culpa."
    ];

    const randomTags = ['#test', '#random', '#generated', '#sample', '#demo'];
    const insertStmt = sqldb.prepare("INSERT INTO tils(user_id, title, description, date, repetitions) VALUES (?,?,?,?,?)");

    for (let i = 0; i < count; i++) {
        const randomDate = Date.now() - Math.floor(Math.random() * 63072000000);
        const title = `Random TIL ${Math.floor(Math.random() * 1000)}`;
        const description = loremIpsum[Math.floor(Math.random() * loremIpsum.length)] + ' ' +
                           randomTags[Math.floor(Math.random() * randomTags.length)];

        const result = insertStmt.run(1, title, description, randomDate, 0);
        const tags = parseHashtags(description);
        module.exports.updateTags(result.lastInsertRowid, tags);
    }

    console.log(`Generated ${count} random TILs`);
}

// Generate a new API key for a user and store it in the database
exports.generateApiKey = function(user_id) {
    const api_key = 'til_' + crypto.randomBytes(24).toString('hex');
    sqldb.prepare('UPDATE users SET api_key = ? WHERE id = ?').run(api_key, user_id);
    return api_key;
}

// Get user by API key
exports.getUserByApiKey = function(api_key) {
    return sqldb.prepare('SELECT id, username FROM users WHERE api_key = ?').get(api_key);
}

// Fix TILs with NULL dates by using the date of the previous TIL
exports.fixNullDates = function() {
    const rows = sqldb.prepare('SELECT id, title, date FROM tils ORDER BY id ASC').all();
    const updateStmt = sqldb.prepare('UPDATE tils SET date = ? WHERE id = ?');
    let lastValidDate = null;
    let fixedCount = 0;

    for (const row of rows) {
        if (row.date === null && lastValidDate !== null) {
            updateStmt.run(lastValidDate, row.id);
            console.log(`Updated TIL #${row.id}: "${row.title}" with date ${dayjs(lastValidDate).format('YYYY-MM-DD HH:mm:ss')}`);
            fixedCount++;
        } else if (row.date !== null) {
            lastValidDate = row.date;
        }
    }

    console.log(`\nSummary: Fixed ${fixedCount} TILs with NULL dates`);
    return fixedCount;
}
