const sqldb = require('../db');
const { TIL_BASE_QUERY } = require('../helpers/queries');

function searchMatch(search) {
  return `"${search.replace(/"/g, '""')}"`;
}

function ftsColumn(column) {
  return column === 'title' ? 'title' : 'description';
}

function searchByFts(userId, search, column, limit, offset) {
  const matchColumn = ftsColumn(column);
  const limitClause = typeof limit === 'number' ? ' LIMIT ? OFFSET ?' : '';
  const params = [searchMatch(search), userId];
  if (typeof limit === 'number') {
    params.push(limit, offset || 0);
  }

  return sqldb.prepare(`WITH fts_matches AS (
      SELECT rowid, rank
      FROM tils_fts
      WHERE ${matchColumn} MATCH ?
    )
    ${TIL_BASE_QUERY}
    JOIN fts_matches ON fts_matches.rowid = tils.id
    WHERE tils.user_id = ?
    GROUP BY tils.id
    ORDER BY fts_matches.rank${limitClause}`).all(...params);
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
  return sqldb.prepare(
    'INSERT INTO tils(user_id, title, description, date, repetitions) VALUES (?,?,?,?,?)'
  ).run(userId, title, description, date, 0);
};

exports.update = function (userId, tilId, title, date, description, isPublic) {
  sqldb.prepare(
    'UPDATE tils SET title = ?, date = ?, description = ?, public = ? WHERE id = ? AND user_id = ?'
  ).run(title, date, description, isPublic, tilId, userId);
};

exports.deleteWithRelated = function (userId, tilId) {
  const til = exports.getIdOnly(userId, tilId);
  if (!til) return false;

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
  return searchByFts(userId, search, 'title');
};

exports.searchByText = function (userId, search) {
  return searchByFts(userId, search, 'description');
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

exports.countSearchByTitle = function (userId, search) {
  return sqldb.prepare(`
    SELECT COUNT(*) AS count
    FROM tils
    JOIN tils_fts ON tils_fts.rowid = tils.id
    WHERE tils.user_id = ? AND tils_fts.title MATCH ?
  `).get(userId, searchMatch(search)).count;
};

exports.searchByTitlePaged = function (userId, search, limit, offset) {
  return searchByFts(userId, search, 'title', limit, offset);
};

exports.countSearchByText = function (userId, search) {
  return sqldb.prepare(`
    SELECT COUNT(*) AS count
    FROM tils
    JOIN tils_fts ON tils_fts.rowid = tils.id
    WHERE tils.user_id = ? AND tils_fts.description MATCH ?
  `).get(userId, searchMatch(search)).count;
};

exports.searchByTextPaged = function (userId, search, limit, offset) {
  return searchByFts(userId, search, 'description', limit, offset);
};

exports.countSearchByDate = function (userId, startMs, endMs) {
  return sqldb.prepare('SELECT COUNT(*) AS count FROM tils WHERE user_id = ? AND date BETWEEN ? AND ?').get(userId, startMs, endMs).count;
};

exports.searchByDatePaged = function (userId, startMs, endMs, limit, offset) {
  return sqldb.prepare(`${TIL_BASE_QUERY}
    WHERE tils.user_id = ? AND tils.date BETWEEN ? AND ?
    GROUP BY tils.id ORDER BY tils.date DESC, tils.id DESC LIMIT ? OFFSET ?`).all(userId, startMs, endMs, limit, offset);
};

exports.countSearchByTag = function (userId, tag) {
  const escaped = tag.replace(/[%_]/g, '\\$&');
  return sqldb.prepare(`SELECT COUNT(*) AS count FROM (
    SELECT * FROM (
      ${TIL_BASE_QUERY}
      WHERE tils.user_id = ?
      GROUP BY tils.id
    ) WHERE tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\'
  )`).get(userId, escaped, `${escaped},%`, `%,${escaped},%`, `%,${escaped}`).count;
};

exports.searchByTagPaged = function (userId, tag, limit, offset) {
  const escaped = tag.replace(/[%_]/g, '\\$&');
  return sqldb.prepare(`SELECT * FROM (
    ${TIL_BASE_QUERY}
    WHERE tils.user_id = ?
    GROUP BY tils.id
  ) WHERE tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\'
    ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`).all(userId, escaped, `${escaped},%`, `%,${escaped},%`, `%,${escaped}`, limit, offset);
};

// Associate orphan images referenced in description
exports.associateImages = function (tilId, userId, description) {
  const imageRefs = description.match(/!\[.*?\]\(\/image\/(\d+)\)/g);
  if (imageRefs) {
    const stmt = sqldb.prepare('UPDATE til_images SET til_id = ? WHERE id = ? AND til_id IS NULL AND user_id = ?');
    const imageIds = imageRefs.map(ref => ref.match(/\/image\/(\d+)/)[1]);
    for (const imgId of imageIds) {
      stmt.run(tilId, imgId, userId);
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
