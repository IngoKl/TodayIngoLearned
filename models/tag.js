const sqldb = require('../db');
const helpers = require('../helpers');
const { TIL_BASE_QUERY } = require('../helpers/queries');

function escapeLike(str) {
  return str.replace(/[%_]/g, '\\$&');
}

exports.getUserTags = function (userId) {
  return [...new Set(helpers.getUserTags(userId))];
};

exports.getUserTagsSorted = function (userId) {
  return exports.getUserTags(userId).sort();
};

exports.findTilsByTag = function (userId, tag) {
  const escaped = escapeLike(tag);
  return sqldb.prepare(`SELECT * FROM (
    ${TIL_BASE_QUERY}
    WHERE tils.user_id = ?
    GROUP BY tils.id
  ) WHERE tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\'`).all(userId, escaped, `%${escaped},%`, `%,${escaped}`);
};

exports.getRelatedTags = function (userId, tag) {
  const escaped = escapeLike(tag);
  const row = sqldb.prepare(`SELECT GROUP_CONCAT(tags) AS tags FROM (
    SELECT GROUP_CONCAT(tags.tag) AS tags
    FROM tils
    JOIN tags_join ON tags_join.til_id = tils.id
    JOIN tags ON tags.id = tags_join.tag_id
    WHERE tils.user_id = ?
    GROUP BY tils.id
  ) WHERE tags LIKE ? ESCAPE '\\'`).get(userId, `%${escaped}%`);
  return row && row.tags ? Array.from(new Set(row.tags.split(','))) : [];
};

exports.getGraphData = function (userId) {
  const nodes = sqldb.prepare(`
    SELECT tags.id, tags.tag, COUNT(DISTINCT tags_join.til_id) AS count
    FROM tags
    JOIN tags_join ON tags.id = tags_join.tag_id
    JOIN tils ON tils.id = tags_join.til_id
    WHERE tils.user_id = ?
    GROUP BY tags.id
  `).all(userId);

  const edges = sqldb.prepare(`
    SELECT t1.tag_id AS source, t2.tag_id AS target,
           COUNT(DISTINCT t1.til_id) AS weight
    FROM tags_join t1
    JOIN tags_join t2 ON t1.til_id = t2.til_id AND t1.tag_id < t2.tag_id
    JOIN tils ON tils.id = t1.til_id
    WHERE tils.user_id = ?
    GROUP BY t1.tag_id, t2.tag_id
  `).all(userId);

  return { nodes, edges };
};
