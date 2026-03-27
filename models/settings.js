const sqldb = require('../db');

let settingsCache = null;

function loadSettings() {
  const rows = sqldb.prepare('SELECT key, value FROM app_settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  settingsCache = settings;
  return settings;
}

exports.getAll = function () {
  if (settingsCache) {
    return settingsCache;
  }
  return loadSettings();
};

exports.get = function (key) {
  const settings = exports.getAll();
  return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : null;
};

exports.set = function (key, value) {
  const existing = sqldb.prepare('SELECT key FROM app_settings WHERE key = ?').get(key);
  if (existing) {
    sqldb.prepare('UPDATE app_settings SET value = ? WHERE key = ?').run(value, key);
  } else {
    sqldb.prepare("INSERT INTO app_settings(key, value) VALUES (?,?)").run(key, value);
  }
  if (settingsCache) {
    settingsCache[key] = value;
  }
};

exports.getNoteColors = function () {
  const val = exports.get('note_colors');
  return val ? val.split(',') : ['#fffffc', '#508991', '#fe5f55', '#0b1d51', '#1e2019'];
};

exports.getNoteColorsString = function () {
  return exports.get('note_colors') || '#fffffc,#508991,#fe5f55,#0b1d51,#1e2019';
};

exports.getPenColorsString = function () {
  return exports.get('pen_colors') || '#4ecdc4,#ffc145,#fffbff,#364652,#ca1551';
};
