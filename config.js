const fs = require('fs');
const path = require('path');

function loadBaseConfig() {
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    return require(configPath);
  }

  const templatePath = path.join(__dirname, 'config.template.json');
  if (fs.existsSync(templatePath)) {
    return require(templatePath);
  }

  return {};
}

function readBool(value, fallback) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function readNumber(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const baseConfig = loadBaseConfig();

module.exports = {
  ...baseConfig,
  name: process.env.TIL_APP_NAME || baseConfig.name || 'TodayIngoLearned',
  dbpath: process.env.TIL_DB_PATH || baseConfig.dbpath || './db/til.db',
  lowercasetags: readBool(process.env.TIL_LOWERCASE_TAGS, baseConfig.lowercasetags !== undefined ? baseConfig.lowercasetags : true),
  expresssessionsecret: process.env.TIL_SESSION_SECRET || baseConfig.expresssessionsecret || 'CHANGE_ME_TO_A_RANDOM_SECRET',
  securecookies: readBool(process.env.TIL_SECURE_COOKIES, Boolean(baseConfig.securecookies)),
  maxage: readNumber(process.env.TIL_MAX_AGE, baseConfig.maxage || 7776000000),
  port: readNumber(process.env.TIL_PORT, baseConfig.port || 3000),
  host: process.env.TIL_HOST || baseConfig.host,
};
