const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createApp } = require('./server');
const { verifyPassword, hashPassword, getJwtSecret } = require('./auth');

const secret = 'test-only-jwt-signing-key-at-least-32-bytes';
const hash = 'scrypt$16384$8$1$31ca9a3f4bcf5e368973fc7cf57d9808$2cefcf5d520dabfe9093ff6a2a67c4fb1165d946689d5ad12bc0ea301a2cf329f6d14942352ff5a50e2f4fa06e67e43a504a12b4121fe4cb8115724eb95b3953';
const morgan = { id: '10000000-0000-0000-0000-000000000002', first_name: 'Morgan', last_name: 'Watson',
  email: 'morgan@example.com', access_role: 'premium', password_hash: hash };
const origin = 'http://localhost:5173';

async function fixture(t, options = {}) {
  const row = { ...morgan };
  const pool = { query: async (sql, params) => ({ rows: params && [row.id, row.email].includes(params[0]) ? [row] : [] }) };
  const { database = pool, ...authOptions } = options;
  const server = createApp(database, { secret, ...authOptions }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie) => fetch(`${base}/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { row, request, base };
}

test('existing scrypt hashes remain compatible; incorrect and malformed hashes fail', async () => {
  assert.equal(await verifyPassword('FinClearDemo!2026', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
  assert.equal(await verifyPassword('wrong', 'invalid'), false);
});

test('new password hashes use unique salts and remain compatible with login verification', async () => {
  const password = 'a long test passphrase 2026';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(first.includes(password), false);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword('wrong password', first), false);
});

const signup = { fullName: 'Taylor Test', email: 'taylor@example.com', password: 'a long test passphrase 2026!',
  confirmPassword: 'a long test passphrase 2026!', acceptedTerms: true };

test('signup requires at least seven characters and a special character', async t => {
  let savedHash;
  const database = { connect: async () => ({
    query: async (sql, params) => {
      if (sql.includes('INSERT INTO users')) {
        savedHash = params[3];
        return { rows: [{ ...morgan, access_role: 'trial', trial_ends_at: new Date(Date.now() + 86400000) }] };
      }
      return { rows: [] };
    },
    release: () => {},
  }) };
  const { request } = await fixture(t, { database });
  for (const password of ['abcde!', 'abcdefg', 'abcdef ', 'ééééééé', 'abcdef1']) {
    const response = await request('signup', { ...signup, password, confirmPassword: password });
    assert.equal(response.status, 400, password);
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal(savedHash, undefined);
  for (const password of ['abcdef!', 'abcdef@', 'abcdef#', 'abcdef-', `${'a'.repeat(127)}!`]) {
    const response = await request('signup', { ...signup, password, confirmPassword: password });
    assert.equal(response.status, 201, password);
    assert.equal(await verifyPassword(password, savedHash), true);
  }
});

test('signup rejects invalid fields, mismatched passwords and missing consent before database access', async t => {
  const { request } = await fixture(t);
  for (const change of [{ fullName: '' }, { fullName: 'a'.repeat(201) }, { email: 'not-an-email' }, { password: 'short' },
    { password: 'a'.repeat(129) }, { confirmPassword: 'different' }, { acceptedTerms: false }, { acceptedTerms: 'true' }, { email: {} },
    { fullName: 'Taylor\u0000Test' }]) {
    assert.equal((await request('signup', { ...signup, ...change })).status, 400);
  }
  assert.equal((await request('signup', signup)).status, 429);
});

test('signup failure never issues a login cookie', async t => {
  const { request } = await fixture(t);
  // The fixture has no connection support, simulating a database outage.
  const response = await request('signup', signup);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('signup rolls back the account when a default record cannot be saved', async t => {
  const statements = [];
  let released = false;
  const database = { connect: async () => ({
    query: async sql => {
      statements.push(sql);
      if (sql.includes('INSERT INTO users')) return { rows: [{ ...morgan, access_role: 'trial', trial_ends_at: new Date(Date.now() + 86400000) }] };
      if (sql.includes('INSERT INTO user_settings')) throw new Error('Default settings could not be saved');
      return { rows: [] };
    },
    release: () => { released = true; },
  }) };
  const { request } = await fixture(t, { database });
  const response = await request('signup', signup);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(statements[0], 'BEGIN');
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.equal(statements.includes('COMMIT'), false);
  assert.equal(released, true);
});

test('Google signup creates a verified account and redirects through the configured origin', async t => {
  const created = { ...morgan, email: 'google@example.com', access_role: 'trial',
    trial_ends_at: new Date(Date.now() + 86400000), email_verified_at: new Date(), session_version: 0 };
  const database = {
    connect: async () => ({
      query: async sql => sql.includes('INSERT INTO users') ? { rows: [created] } : { rows: [] },
      release: () => {},
    }),
    query: async () => ({ rows: [] }),
  };
  const fetcher = async url => url.includes('oauth2.googleapis.com/token')
    ? { ok: true, json: async () => ({ access_token: 'google-access-token' }) }
    : { ok: true, json: async () => ({ sub: 'google-subject', email: created.email, email_verified: true }) };
  const { base, request } = await fixture(t, {
    database,
    google: { clientId: 'client-id', clientSecret: 'client-secret', redirectUri: `${origin}/api/auth/google/callback` },
    fetcher,
  });
  const start = await request('google/start', { mode: 'signup', acceptedTerms: true });
  const authorizationUrl = new URL((await start.json()).url);
  const stateCookie = start.headers.get('set-cookie').split(';')[0];
  const callback = await fetch(`${base}/api/auth/google/callback?code=authorization-code&state=${authorizationUrl.searchParams.get('state')}`,
    { headers: { Cookie: stateCookie }, redirect: 'manual' });

  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get('location'), `${origin}/#onboarding`);
  assert.match(callback.headers.get('set-cookie'), /finclear_auth=/);
});

test('login normalizes email, issues a restricted JWT cookie and returns no credentials', async t => {
  const { request } = await fixture(t);
  const response = await request('login', { email: ' MORGAN@EXAMPLE.COM ', password: 'FinClearDemo!2026', role: 'guest' });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /Path=\/api/); assert.match(cookie, /Max-Age=900/);
  const data = await response.json();
  assert.equal(data.user.role, 'premium'); assert.equal(data.user.firstName, 'Morgan');
  assert.equal(data.user.password_hash, undefined); assert.equal(data.token, undefined);
  const claims = jwt.verify(cookie.split(';')[0].split('=')[1], secret, { algorithms: ['HS256'], issuer: 'finclear', audience: 'finclear-web' });
  assert.equal(claims.exp - claims.iat, 900);
  const me = await request('me', undefined, cookie.split(';')[0]);
  assert.equal(me.status, 200); assert.equal((await me.json()).user.id, morgan.id);
  assert.equal(me.headers.get('cache-control'), 'no-store');
});

test('account authorization endpoints require verified email and enforce plan permissions', async t => {
  const { request, base, row } = await fixture(t);
  const login = await request('login', { email: morgan.email, password: 'FinClearDemo!2026' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const get = path => fetch(`${base}/api/account/${path}`, { headers: { Cookie: cookie } });
  const plaidStatus = () => fetch(`${base}/api/plaid/status`, { headers: { Cookie: cookie } });

  assert.equal((await get('permissions')).status, 403);
  assert.equal((await plaidStatus()).status, 403);
  row.email_verified_at = new Date();
  assert.equal((await get('permissions')).status, 200);
  assert.equal((await plaidStatus()).status, 200);
  assert.equal((await get('report-access')).status, 204);
  row.access_role = 'free';
  assert.equal((await get('report-access')).status, 403);
});

test('incorrect password and nonexistent account return the same error', async t => {
  const { request } = await fixture(t);
  const wrong = await request('login', { email: morgan.email, password: 'wrong' });
  const missing = await request('login', { email: 'absent@example.com', password: 'wrong' });
  assert.equal(wrong.status, 401); assert.equal(missing.status, 401);
  assert.deepEqual(await wrong.json(), await missing.json());
  assert.equal(wrong.headers.get('set-cookie'), null);
});

test('missing, expired, tampered, wrong-algorithm and wrong-audience JWTs are rejected', async t => {
  const { request } = await fixture(t);
  const sign = opts => jwt.sign({}, secret, { subject: morgan.id, issuer: 'finclear', audience: 'finclear-web', expiresIn: '15m', ...opts });
  const tampered = sign({}).split('.'); tampered[1] = Buffer.from(JSON.stringify({ sub: 'other-user' })).toString('base64url');
  for (const token of ['', sign({ expiresIn: -1 }), tampered.join('.'), sign({ algorithm: 'HS384' }), sign({ audience: 'other-app' })]) {
    assert.equal((await request('me', undefined, `finclear_auth=${token}`)).status, 401);
  }
});

test('current role is loaded from the database and deleted users lose access', async t => {
  const { request, row } = await fixture(t);
  const login = await request('login', { email: morgan.email, password: 'FinClearDemo!2026' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  row.access_role = 'free';
  assert.equal((await (await request('me', undefined, cookie)).json()).user.role, 'free');
  row.id = 'deleted'; row.email = 'deleted@example.com';
  assert.equal((await request('me', undefined, cookie)).status, 401);
});

test('logout clears the browser cookie; unauthenticated requests remain blocked', async t => {
  const { request } = await fixture(t);
  const response = await request('logout', {});
  assert.equal(response.status, 204);
  assert.match(response.headers.get('set-cookie'), /finclear_auth=;/);
  assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('me')).status, 401);
});

test('cross-origin login and form submissions are rejected', async t => {
  const { base, request } = await fixture(t);
  const evil = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' });
  const form = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=x' });
  assert.equal(evil.status, 403); assert.equal(form.status, 403);
  assert.equal((await request('login', { email: [], password: {} })).status, 400);
});

test('login attempts are rate-limited', async t => {
  const { request } = await fixture(t);
  for (let i = 0; i < 10; i++) await request('login', {});
  assert.equal((await request('login', {})).status, 429);
});

test('production cookie is Secure and weak configured secrets are rejected', async t => {
  const { request } = await fixture(t, { production: true });
  const response = await request('login', { email: morgan.email, password: 'FinClearDemo!2026' });
  assert.match(response.headers.get('set-cookie'), /Secure/);
  const old = process.env.JWT_SECRET;
  try { process.env.JWT_SECRET = 'weak'; assert.throws(getJwtSecret, /32 bytes/); }
  finally { if (old === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = old; }
});
