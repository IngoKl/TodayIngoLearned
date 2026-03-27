const sqldb = require('../db');
const { TIL_BASE_QUERY } = require('../helpers/queries');

// FTS index sync helpers (inlined to avoid circular dependency with helpers/index.js)
function ftsInsert(tilId, title, description) {
  sqldb.prepare('INSERT INTO tils_fts(rowid, title, description) VALUES (?, ?, ?)').run(tilId, title, description);
}

function ftsUpdate(tilId, title, description) {
  const old = sqldb.prepare('SELECT title, description FROM tils WHERE id = ?').get(tilId);
  if (old) {
    sqldb.prepare("INSERT INTO tils_fts(tils_fts, rowid, title, description) VALUES ('delete', ?, ?, ?)").run(tilId, old.title, old.description);
  }
  sqldb.prepare('INSERT INTO tils_fts(rowid, title, description) VALUES (?, ?, ?)').run(tilId, title, description);
}

function ftsDelete(tilId) {
  const old = sqldb.prepare('SELECT title, description FROM tils WHERE id = ?').get(tilId);
  if (old) {
    sqldb.prepare("INSERT INTO tils_fts(tils_fts, rowid, title, description) VALUES ('delete', ?, ?, ?)").run(tilId, old.title, old.description);
  }
}

exports.getById = function (userId, tilId) {
  return sqldb.prepare(`${TIL_BASE_QUERY}
    WHERE tils.user_id = ? AND tils.id = ? GROUP BY tils.id`).get(userId, tilId);
};

exports.getByIdRaw = function (userId, tilId) {
  return sqldb.prepare('SELECT * FROM tils WHERE id = ? AND user_id = ?').get(tilId, userId);
};

exports.getIdOnly = function (userId, tilId) {
  return sqldb.prepare('SELECT id FROM tils WHERE id = ? AND user_id = ?').get(tilId, userId);
};

exports.listPaged = function (userId, perPage, offset) {
  return sqldb.prepare(`${TIL_BASE_QUERY}
    WHERE tils.user_id = ? GROUP BY tils.id ORDER BY tils.date DESC, tils.id DESC LIMIT ? OFFSET ?`).all(userId, perPage, offset);
};

exports.countAll = function (userId) {
  return sqldb.prepare('SELECT COUNT(*) AS count FROM tils WHERE user_id = ?').get(userId).count;
};

exports.create = function (userId, title, description, date) {
  const result = sqldb.prepare(
    'INSERT INTO tils(user_id, title, description, date, repetitions) VALUES (?,?,?,?,?)'
  ).run(userId, title, description, date, 0);
  ftsInsert(result.lastInsertRowid, title, description);
  return result;
};

exports.update = function (userId, tilId, title, date, description, isPublic) {
  ftsUpdate(tilId, title, description);
  sqldb.prepare(
    'UPDATE tils SET title = ?, date = ?, description = ?, public = ? WHERE id = ? AND user_id = ?'
  ).run(title, date, description, isPublic, tilId, userId);
};

exports.deleteWithRelated = function (userId, tilId) {
  const til = exports.getIdOnly(userId, tilId);
  if (!til) return false;

  ftsDelete(tilId);
  sqldb.prepare('DELETE FROM tags_join WHERE til_id = ?').run(tilId);
  sqldb.prepare('DELETE FROM bookmarks WHERE til_id = ?').run(tilId);
  sqldb.prepare('DELETE FROM til_comments WHERE til_id = ?').run(tilId);
  sqldb.prepare('DELETE FROM til_images WHERE til_id = ?').run(tilId);
  sqldb.prepare('DELETE FROM tils WHERE id = ?').run(tilId);
  return true;
};

exports.getRandom = function (userId) {
  return sqldb.prepare('SELECT * FROM tils WHERE user_id = ? ORDER BY RANDOM() LIMIT 1').get(userId);
};

exports.getPublicById = function (tilId) {
  return sqldb.prepare(`${TIL_BASE_QUERY}
    WHERE tils.id = ? AND tils.public = 1 GROUP BY tils.id`).get(tilId);
};

exports.listPublicByUser = function (userId) {
  return sqldb.prepare(`${TIL_BASE_QUERY}
    WHERE tils.user_id = ? AND tils.public = 1
    GROUP BY tils.id ORDER BY tils.date DESC`).all(userId);
};

exports.getTimeline = function (userId) {
  return sqldb.prepare(`
    SELECT tils.id, tils.title, tils.date,
           strftime('%Y-%m', datetime(date/1000, 'unixepoch')) as month
    FROM tils
    WHERE tils.user_id = ?
    ORDER BY tils.date DESC`).all(userId);
};

exports.getRelated = function (tilId, userId) {
  return sqldb.prepare(`
    SELECT tils.id, tils.title, tils.date, GROUP_CONCAT(DISTINCT tags.tag) AS shared_tags,
           COUNT(DISTINCT shared_tj.tag_id) AS shared_count
    FROM tags_join AS shared_tj
    JOIN tags_join AS current_tj ON shared_tj.tag_id = current_tj.tag_id
    JOIN tils ON tils.id = shared_tj.til_id
    JOIN tags ON tags.id = shared_tj.tag_id
    WHERE current_tj.til_id = ?
      AND shared_tj.til_id != ?
      AND tils.user_id = ?
    GROUP BY tils.id
    ORDER BY shared_count DESC, tils.date DESC
    LIMIT 5
  `).all(tilId, tilId, userId);
};

// Search methods
exports.searchByTitle = function (userId, search) {
  return sqldb.prepare(`${TIL_BASE_QUERY}
    JOIN tils_fts ON tils_fts.rowid = tils.id
    WHERE tils.user_id = ? AND tils_fts.title MATCH ?
    GROUP BY tils.id ORDER BY rank`).all(userId, `"${search.replace(/"/g, '""')}"`);
};

exports.searchByText = function (userId, search) {
  return sqldb.prepare(`${TIL_BASE_QUERY}
    WHERE tils.user_id = ? AND tils.id IN (
      SELECT rowid FROM tils_fts WHERE tils_fts.description MATCH ?
    ) GROUP BY tils.id`).all(userId, `"${search.replace(/"/g, '""')}"`);
};

exports.searchByDate = function (userId, startMs, endMs) {
  return sqldb.prepare(`${TIL_BASE_QUERY}
    WHERE tils.user_id = ? AND tils.date BETWEEN ? AND ? GROUP BY tils.id`).all(userId, startMs, endMs);
};

exports.searchByTag = function (userId, tag) {
  const escaped = tag.replace(/[%_]/g, '\\$&');
  return sqldb.prepare(`SELECT * FROM (
    ${TIL_BASE_QUERY}
    WHERE tils.user_id = ?
    GROUP BY tils.id
  ) WHERE tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\'`).all(userId, escaped, `${escaped},%`, `%,${escaped},%`, `%,${escaped}`);
};

// Associate orphan images referenced in description
exports.associateImages = function (tilId, description) {
  const imageRefs = description.match(/!\[.*?\]\(\/image\/(\d+)\)/g);
  if (imageRefs) {
    const stmt = sqldb.prepare('UPDATE til_images SET til_id = ? WHERE id = ? AND til_id IS NULL');
    const imageIds = imageRefs.map(ref => ref.match(/\/image\/(\d+)/)[1]);
    for (const imgId of imageIds) {
      stmt.run(tilId, imgId);
    }
  }
};

// Study-related
exports.getNextStudyPick = function (userId, nowUnix) {
  return sqldb.prepare(
    'SELECT tils.id FROM tils WHERE tils.user_id = ? AND tils.next_repetition < ? ORDER BY RANDOM() LIMIT 1'
  ).get(userId, nowUnix);
};

exports.recordStudy = function (userId, tilId, lastRepUnix, nextRepUnix) {
  sqldb.prepare(
    'UPDATE tils SET repetitions = repetitions + 1, last_repetition = ?, next_repetition = ? WHERE id = ? AND user_id = ?'
  ).run(lastRepUnix, nextRepUnix, tilId, userId);
};

exports.getStudyStats = function (userId, nowUnix) {
  const total = sqldb.prepare('SELECT COUNT(*) AS count FROM tils WHERE user_id = ?').get(userId).count;
  const studied = sqldb.prepare('SELECT COUNT(*) AS count FROM tils WHERE user_id = ? AND repetitions > 0').get(userId).count;
  const dueNow = sqldb.prepare('SELECT COUNT(*) AS count FROM tils WHERE user_id = ? AND next_repetition < ?').get(userId, nowUnix).count;
  const totalReps = sqldb.prepare('SELECT COALESCE(SUM(repetitions), 0) AS total FROM tils WHERE user_id = ?').get(userId).total;

  return { total_tils: total, studied, never_studied: total - studied, due_now: dueNow, total_repetitions: totalReps };
};

exports.getStudiedTils = function (userId) {
  return sqldb.prepare(`SELECT tils.id, tils.title, tils.repetitions, tils.last_repetition, tils.next_repetition, GROUP_CONCAT(tags.tag) AS tags
    FROM tils
    LEFT JOIN tags_join ON tags_join.til_id = tils.id
    LEFT JOIN tags ON tags.id = tags_join.tag_id
    WHERE tils.user_id = ? AND tils.repetitions > 0
    GROUP BY tils.id
    ORDER BY tils.next_repetition ASC`).all(userId);
};

// Export
exports.getExportData = function (userId) {
  return sqldb.prepare(`
    SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions,
           tils.last_repetition, tils.next_repetition, tils.public,
           GROUP_CONCAT(tags.tag) AS tags
    FROM tils
    LEFT JOIN tags_join ON tags_join.til_id = tils.id
    LEFT JOIN tags ON tags.id = tags_join.tag_id
    WHERE tils.user_id = ?
    GROUP BY tils.id
    ORDER BY tils.date DESC
  `).all(userId);
};
