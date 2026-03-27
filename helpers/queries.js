// Common TIL query base - shared across routes for consistency.
// Append WHERE, GROUP BY, ORDER BY, LIMIT as needed.
//
// Date convention:
//   tils.date            -> milliseconds (Date.now())
//   tils.last_repetition -> Unix seconds (dayjs().unix())
//   tils.next_repetition -> Unix seconds (dayjs().unix())
const TIL_BASE_QUERY = `SELECT tils.id, tils.title, tils.description, tils.date, tils.repetitions,
    tils.last_repetition, tils.next_repetition, tils.public, GROUP_CONCAT(tags.tag) AS tags
    FROM tils LEFT JOIN tags_join ON tags_join.til_id = tils.id
    LEFT JOIN tags ON tags.id = tags_join.tag_id`;

module.exports = { TIL_BASE_QUERY };
