// Date utility helpers — make the ms vs. Unix-seconds convention explicit.
//
// Convention (see also helpers/queries.js):
//   tils.date            -> milliseconds  (Date.now())
//   tils.last_repetition -> Unix seconds  (dayjs().unix())
//   tils.next_repetition -> Unix seconds  (dayjs().unix())

const dayjs = require('dayjs');

// Convert a value to milliseconds (for tils.date)
exports.toMillis = function (value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime();
  return Number(value);
};

// Convert a value to Unix seconds (for repetition fields)
exports.toUnixSeconds = function (value) {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === 'string') return Math.floor(new Date(value).getTime() / 1000);
  return Math.floor(Number(value));
};

// Current time in milliseconds
exports.nowMillis = function () {
  return Date.now();
};

// Current time in Unix seconds
exports.nowUnixSeconds = function () {
  return dayjs().unix();
};

// Get start/end of a day in milliseconds (for date-range queries on tils.date)
exports.dayRangeMillis = function (timestamp) {
  const start = dayjs(timestamp).startOf('day').valueOf();
  const end = dayjs(timestamp).endOf('day').valueOf();
  return [start, end];
};
