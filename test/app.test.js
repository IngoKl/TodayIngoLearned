const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '..');
const LOGIN_PATH = '/login';
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn2K7sAAAAASUVORK5CYII=',
  'base64'
);

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  capture(headers) {
    const setCookie = headers.get('set-cookie');
    if (!setCookie) return;

    const cookiePair = setCookie.split(';', 1)[0];
    const separator = cookiePair.indexOf('=');
    if (separator === -1) return;

    const name = cookiePair.slice(0, separator).trim();
    const value = cookiePair.slice(separator + 1).trim();
    this.cookies.set(name, value);
  }

  header() {
    return Array.from(this.cookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

function hashLegacyPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function extractCsrfToken(html) {
  const match = html.match(/name="_csrf" value="([^"]+)"/);
  assert.ok(match, 'expected CSRF token in HTML');
  return match[1];
}

function urlEncoded(body) {
  return new URLSearchParams(body).toString();
}

function parseTilId(locationHeader) {
  const match = String(locationHeader || '').match(/\/til\/view\/(\d+)/);
  assert.ok(match, `expected TIL redirect location, got "${locationHeader}"`);
  return Number(match[1]);
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on('error', reject);
  });
}

async function request(baseUrl, pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  const jar = options.jar;

  if (jar) {
    const cookieHeader = jar.header();
    if (cookieHeader) {
      headers.set('cookie', cookieHeader);
    }
  }

  const response = await fetch(new URL(pathname, baseUrl), {
    ...options,
    headers,
    redirect: options.redirect || 'manual',
  });

  if (jar) {
    jar.capture(response.headers);
  }

  return response;
}

async function waitForServer(baseUrl, child, logs) {
  const timeoutAt = Date.now() + 15000;

  while (Date.now() < timeoutAt) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early.\nstdout:\n${logs.stdout}\nstderr:\n${logs.stderr}`);
    }

    try {
      const response = await fetch(new URL('/health', baseUrl));
      if (response.ok) {
        return;
      }
    } catch (err) {
      // Retry until the server is ready or times out.
    }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  throw new Error(`Timed out waiting for server.\nstdout:\n${logs.stdout}\nstderr:\n${logs.stderr}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;

  await new Promise(resolve => {
    child.once('exit', resolve);
    child.kill();
  });
}

async function login(baseUrl, username, password) {
  const jar = new CookieJar();

  const loginPage = await request(baseUrl, LOGIN_PATH, { jar });
  assert.equal(loginPage.status, 200);
  const csrfToken = extractCsrfToken(await loginPage.text());

  const loginResponse = await request(baseUrl, LOGIN_PATH, {
    jar,
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: urlEncoded({ username, password, _csrf: csrfToken }),
  });

  assert.equal(loginResponse.status, 302);
  assert.equal(loginResponse.headers.get('location'), '/');

  return jar;
}

function readUserPassword(dbPath, username) {
  const db = new Database(dbPath, { readonly: true });
  const row = db.prepare('SELECT password FROM users WHERE username = ?').get(username);
  db.close();
  return row ? row.password : null;
}

async function createTestServer() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todayingolearned-'));
  const dbPath = path.join(tempDir, 'til-test.db');
  const port = await getFreePort();
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    TIL_APP_NAME: 'TodayIngoLearned Test',
    TIL_DB_PATH: dbPath,
    TIL_PORT: String(port),
    TIL_SESSION_SECRET: 'test-session-secret',
    TIL_SECURE_COOKIES: 'false',
  };

  execFileSync(process.execPath, ['-e', "require('./db/create').newDb()"], {
    cwd: ROOT,
    env,
    stdio: 'pipe',
  });

  const db = new Database(dbPath);
  const password = 'correct horse battery staple';
  const adminPassword = 'admin password';
  const legacyPassword = 'legacy password';
  const userId = 1;
  const adminUserId = 2;
  const legacyUserId = 3;
  const now = Date.now();
  const apiKey = 'til_test_api_key';

  db.exec('ALTER TABLE users ADD COLUMN api_key TEXT');

  db.prepare('INSERT INTO users(id, username, password, displayname, is_admin, api_key) VALUES (?,?,?,?,?,?)')
    .run(userId, 'testuser', hashPassword(password), 'Test User', 0, apiKey);
  db.prepare('INSERT INTO users(id, username, password, displayname, is_admin, api_key) VALUES (?,?,?,?,?,?)')
    .run(adminUserId, 'adminuser', hashPassword(adminPassword), 'Admin User', 1, null);
  db.prepare('INSERT INTO users(id, username, password, displayname, is_admin, api_key) VALUES (?,?,?,?,?,?)')
    .run(legacyUserId, 'legacyuser', hashLegacyPassword(legacyPassword), 'Legacy User', 0, null);

  const privateTil = db.prepare(
    'INSERT INTO tils(user_id, title, description, date, repetitions, public) VALUES (?,?,?,?,?,?)'
  ).run(userId, 'Private Image TIL', 'Private image entry', now, 0, 0);

  const publicTil = db.prepare(
    'INSERT INTO tils(user_id, title, description, date, repetitions, public) VALUES (?,?,?,?,?,?)'
  ).run(userId, 'Public Image TIL', 'Public image entry', now, 0, 1);

  const privateImage = db.prepare(
    'INSERT INTO til_images(user_id, til_id, image_data, mime_type, filename, created_at, source) VALUES (?,?,?,?,?,?,?)'
  ).run(userId, Number(privateTil.lastInsertRowid), PNG_1X1, 'image/png', 'private.png', now, 'til');

  const publicImage = db.prepare(
    'INSERT INTO til_images(user_id, til_id, image_data, mime_type, filename, created_at, source) VALUES (?,?,?,?,?,?,?)'
  ).run(userId, Number(publicTil.lastInsertRowid), PNG_1X1, 'image/png', 'public.png', now, 'til');

  const tempImage = db.prepare(
    'INSERT INTO til_images(user_id, til_id, image_data, mime_type, filename, created_at, source) VALUES (?,?,?,?,?,?,?)'
  ).run(userId, null, PNG_1X1, 'image/png', 'temp.png', now, 'til');

  db.close();

  const logs = { stdout: '', stderr: '' };
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', chunk => {
    logs.stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    logs.stderr += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServer(baseUrl, child, logs);

  return {
    baseUrl,
    child,
    dbPath,
    logs,
    password,
    adminPassword,
    legacyPassword,
    apiKey,
    privateImageId: Number(privateImage.lastInsertRowid),
    publicImageId: Number(publicImage.lastInsertRowid),
    tempImageId: Number(tempImage.lastInsertRowid),
    privateTilId: Number(privateTil.lastInsertRowid),
    publicTilId: Number(publicTil.lastInsertRowid),
    userId,
    tempDir,
  };
}

test('app integration', { timeout: 60000 }, async (t) => {
  const ctx = await createTestServer();

  t.after(async () => {
    await stopServer(ctx.child);
    fs.rmSync(ctx.tempDir, { recursive: true, force: true });
  });

  await t.test('redirects anonymous users to login', async () => {
    const response = await request(ctx.baseUrl, '/');
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/login');
  });

  await t.test('rejects state-changing requests without a CSRF token', async () => {
    const jar = await login(ctx.baseUrl, 'testuser', ctx.password);

    const response = await request(ctx.baseUrl, '/til/add', {
      jar,
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: urlEncoded({
        title: 'Missing CSRF',
        description: 'Should fail #misc',
        date: '2026-03-27',
      }),
    });

    assert.equal(response.status, 403);
    assert.match(await response.text(), /Invalid or missing CSRF token/);
  });

  await t.test('upgrades legacy password hashes on successful login', async () => {
    const before = readUserPassword(ctx.dbPath, 'legacyuser');
    assert.equal(before, hashLegacyPassword(ctx.legacyPassword));

    await login(ctx.baseUrl, 'legacyuser', ctx.legacyPassword);

    const after = readUserPassword(ctx.dbPath, 'legacyuser');
    assert.ok(after.startsWith('scrypt:'), `expected scrypt hash, got "${after}"`);
    assert.notEqual(after, before);
  });

  await t.test('keeps title search in sync across create, update, and delete', async () => {
    const jar = await login(ctx.baseUrl, 'testuser', ctx.password);

    const addPage = await request(ctx.baseUrl, '/til/add', { jar });
    const addCsrfToken = extractCsrfToken(await addPage.text());

    const createResponse = await request(ctx.baseUrl, '/til/add', {
      jar,
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: urlEncoded({
        title: 'Trigger Search Title',
        description: 'Searchable text #misc',
        date: '2026-03-27',
        _csrf: addCsrfToken,
      }),
    });

    assert.equal(createResponse.status, 302);
    const tilId = parseTilId(createResponse.headers.get('location'));

    const searchAfterCreate = await request(ctx.baseUrl, '/?searchtype=title&search=Trigger%20Search%20Title', { jar });
    const createHtml = await searchAfterCreate.text();
    assert.match(createHtml, /1 results found\./);
    assert.match(createHtml, /Trigger Search Title/);

    const editPage = await request(ctx.baseUrl, `/til/edit/${tilId}`, { jar });
    const editCsrfToken = extractCsrfToken(await editPage.text());

    const updateResponse = await request(ctx.baseUrl, `/til/edit/${tilId}`, {
      jar,
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: urlEncoded({
        title: 'Updated Search Title',
        description: 'Searchable text #misc',
        date: '2026-03-28',
        _csrf: editCsrfToken,
      }),
    });

    assert.equal(updateResponse.status, 302);

    const searchOldTitle = await request(ctx.baseUrl, '/?searchtype=title&search=Trigger%20Search%20Title', { jar });
    assert.match(await searchOldTitle.text(), /0 results found\./);

    const searchNewTitle = await request(ctx.baseUrl, '/?searchtype=title&search=Updated%20Search%20Title', { jar });
    const newTitleHtml = await searchNewTitle.text();
    assert.match(newTitleHtml, /1 results found\./);
    assert.match(newTitleHtml, /Updated Search Title/);

    const deleteResponse = await request(ctx.baseUrl, `/til/edit/${tilId}/delete`, {
      jar,
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: urlEncoded({ _csrf: editCsrfToken }),
    });

    assert.equal(deleteResponse.status, 302);

    const searchAfterDelete = await request(ctx.baseUrl, '/?searchtype=title&search=Updated%20Search%20Title', { jar });
    assert.match(await searchAfterDelete.text(), /0 results found\./);
  });

  await t.test('requires a valid API key and supports create/fetch/search', async () => {
    const missingKey = await request(ctx.baseUrl, '/api/v1/til/1');
    assert.equal(missingKey.status, 401);
    assert.deepEqual(await missingKey.json(), { error: 'Missing X-API-Key header' });

    const invalidKey = await request(ctx.baseUrl, '/api/v1/til/1', {
      headers: { 'x-api-key': 'til_invalid_key' },
    });
    assert.equal(invalidKey.status, 401);
    assert.deepEqual(await invalidKey.json(), { error: 'Invalid API key' });

    const createResponse = await request(ctx.baseUrl, '/api/v1/til', {
      method: 'POST',
      headers: {
        'x-api-key': ctx.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'API Created Title',
        description: 'Created through the API #misc',
        date: '2026-03-29',
      }),
    });

    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.title, 'API Created Title');
    assert.deepEqual(created.tags, ['#misc']);

    const fetchCreated = await request(ctx.baseUrl, `/api/v1/til/${created.id}`, {
      headers: { 'x-api-key': ctx.apiKey },
    });
    assert.equal(fetchCreated.status, 200);
    const fetched = await fetchCreated.json();
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.title, 'API Created Title');

    const searchCreated = await request(ctx.baseUrl, '/api/v1/til/search?type=title&q=API%20Created%20Title', {
      headers: { 'x-api-key': ctx.apiKey },
    });
    assert.equal(searchCreated.status, 200);
    const searchResults = await searchCreated.json();
    assert.equal(searchResults.count, 1);
    assert.equal(searchResults.results[0].id, created.id);
  });

  await t.test('exposes only public content on public routes', async () => {
    const privateTil = await request(ctx.baseUrl, `/public/${ctx.privateTilId}`);
    assert.equal(privateTil.status, 404);

    const publicTil = await request(ctx.baseUrl, `/public/${ctx.publicTilId}`);
    assert.equal(publicTil.status, 200);
    const publicTilHtml = await publicTil.text();
    assert.match(publicTilHtml, /Public Image TIL/);

    const publicProfile = await request(ctx.baseUrl, `/public/user/${ctx.userId}`);
    assert.equal(publicProfile.status, 200);
    const publicProfileHtml = await publicProfile.text();
    assert.match(publicProfileHtml, /Public Image TIL/);
    assert.doesNotMatch(publicProfileHtml, /Private Image TIL/);
  });

  await t.test('serves public images anonymously and restricts private ones', async () => {
    const privateAnonymousResponse = await request(ctx.baseUrl, `/image/${ctx.privateImageId}`);
    assert.equal(privateAnonymousResponse.status, 403);

    const publicAnonymousResponse = await request(ctx.baseUrl, `/image/${ctx.publicImageId}`);
    assert.equal(publicAnonymousResponse.status, 200);
    assert.match(publicAnonymousResponse.headers.get('content-type') || '', /^image\/png/);
    assert.ok((await publicAnonymousResponse.arrayBuffer()).byteLength > 0);

    const jar = await login(ctx.baseUrl, 'testuser', ctx.password);
    const privateOwnerResponse = await request(ctx.baseUrl, `/image/${ctx.privateImageId}`, { jar });
    assert.equal(privateOwnerResponse.status, 200);
  });

  await t.test('restricts temporary upload images to the owner', async () => {
    const anonymousResponse = await request(ctx.baseUrl, `/image/${ctx.tempImageId}`);
    assert.equal(anonymousResponse.status, 403);

    const jar = await login(ctx.baseUrl, 'testuser', ctx.password);
    const ownerResponse = await request(ctx.baseUrl, `/image/${ctx.tempImageId}`, { jar });
    assert.equal(ownerResponse.status, 200);
    assert.match(ownerResponse.headers.get('content-type') || '', /^image\/png/);
  });

  await t.test('allows admins into /admin and blocks regular users', async () => {
    const regularJar = await login(ctx.baseUrl, 'testuser', ctx.password);
    const regularResponse = await request(ctx.baseUrl, '/admin', { jar: regularJar });
    assert.equal(regularResponse.status, 403);

    const adminJar = await login(ctx.baseUrl, 'adminuser', ctx.adminPassword);
    const adminResponse = await request(ctx.baseUrl, '/admin', { jar: adminJar });
    assert.equal(adminResponse.status, 200);
    assert.match(await adminResponse.text(), /Create New User/);
  });
});
