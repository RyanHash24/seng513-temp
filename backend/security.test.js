const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { readFileSync } = require('node:fs');
const { createAuth, verifyPassword } = require('./auth');
const { createSecurity } = require('./security');

const owner = '10000000-0000-0000-0000-000000000002';
const other = '10000000-0000-0000-0000-000000000003';
const secret = 'security-test-only-signing-key-at-least-32-bytes';
const origin = 'http://localhost:5173';
const hash = readFileSync(`${__dirname}/../database/seed.sql`, 'utf8').match(/'morgan@example\.com', '(scrypt[^']+)'/)[1];
const currentPassword = 'FinClearDemo!2026';
const nextPassword = 'A different test password!2026';

async function fixture(t, options = {}) {
  let row = { id: owner, first_name: 'Morgan', last_name: 'Test', email: 'morgan@example.com', access_role: 'premium', password_hash: hash, session_version: 0, password_changed_at: null };
  let saved;
  const queries = [];
  const client = { release() {}, async query(sql, params) {
    queries.push({ sql, params });
    if (options.failure?.(sql)) throw Object.assign(new Error('Private database failure'), { code: options.failureCode });
    if (sql === 'BEGIN') saved = { ...row };
    if (sql === 'ROLLBACK') row = saved;
    if (sql.includes('FOR UPDATE NOWAIT')) {
      if (options.stale) row.session_version++;
      return { rows: [{ ...row }] };
    }
    if (sql.startsWith('UPDATE users SET password_hash')) {
      assert.equal(params[1], owner);
      row.password_hash = params[0]; row.session_version++; row.password_changed_at = new Date().toISOString();
      return { rowCount: 1, rows: [{ ...row }] };
    }
    if (sql.startsWith('UPDATE users SET session_version')) {
      assert.deepEqual(params, [owner]); row.session_version++;
      return { rowCount: 1, rows: [{ ...row }] };
    }
    return { rows: [] };
  } };
  const pool = { connect: async () => client, query: async (sql, params) => ({ rows: params?.[0] === owner || params?.[0] === row.email ? [{ ...row }] : [] }) };
  const auth = createAuth(pool, { secret, origins: [origin] });
  const app = express(); app.use(express.json()); app.use('/api/auth', auth.router);
  app.use('/api/security', createSecurity(pool, auth.requireAuth, { origins: [origin], issueSession: auth.issueSession, clearSession: auth.clearSession }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = payload => `finclear_auth=${jwt.sign(payload || {}, secret, { subject: owner, issuer: 'finclear', audience: 'finclear-web', expiresIn: '15m' })}`;
  const original = cookie();
  return { row: () => row, queries, cookie, original, async request(path = '', body, headers = {}) {
    return fetch(`${base}/api/security${path ? `/${path}` : ''}`, { method: body ? 'POST' : 'GET', headers: {
      Origin: origin, 'Content-Type': 'application/json', Cookie: original, ...headers,
    }, body: body ? JSON.stringify(body) : undefined });
  }, async me(value = original) { return fetch(base + '/api/auth/me', { headers: { Cookie: value } }); },
  async login(password) { return fetch(base + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'morgan@example.com', password }) }); } };
}
const update = { currentPassword, newPassword: nextPassword, confirmPassword: nextPassword };

test('security details require authentication and contain real metadata without credentials or invented devices', async t => {
  const { request, original } = await fixture(t);
  assert.equal((await request('', undefined, { Cookie: '' })).status, 401);
  const response = await request();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { email: 'morgan@example.com', signInMethod: 'password', passwordChangedAt: null, sessionLifetimeMinutes: 15 });
  assert.equal((await request('password', update, { Cookie: original, Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await request('password', update, { 'Content-Type': 'text/plain' })).status, 403);
});

test('password changes reject invalid fields before database mutation', async t => {
  const { request, queries } = await fixture(t);
  for (const change of [{ currentPassword: '' }, { currentPassword: 3 }, { currentPassword: 'a'.repeat(1025) },
    { newPassword: 'short!' }, { newPassword: 'nospecialcharacters' }, { newPassword: 'a'.repeat(128) + '!' }, { confirmPassword: 'different' }]) {
    assert.equal((await request('password', { ...update, ...change })).status, 400);
  }
  assert.equal(queries.length, 0);
});

test('wrong current password and unchanged new password preserve hashes, timestamps and all existing sessions', async t => {
  const { request, row, me } = await fixture(t);
  assert.equal((await request('password', { ...update, currentPassword: 'wrong' })).status, 403);
  assert.equal((await request('password', { currentPassword, newPassword: currentPassword, confirmPassword: currentPassword })).status, 400);
  assert.equal(row().password_hash, hash);
  assert.equal(row().password_changed_at, null);
  assert.equal(row().session_version, 0);
  assert.equal((await me()).status, 200);
});

test('password changes salt and hash the new password, revoke old sessions and rotate only the authenticated user’s cookie', async t => {
  const { request, row, me, cookie, login } = await fixture(t);
  const explicitVersionZero = cookie({ sv: 0, jti: 'other-browser' });
  const response = await request('password', { ...update, userId: other });
  assert.equal(response.status, 200);
  assert.equal(row().session_version, 1);
  assert.notEqual(row().password_hash, hash);
  assert.equal(await verifyPassword(nextPassword, row().password_hash), true);
  assert.equal(await verifyPassword(currentPassword, row().password_hash), false);
  const body = await response.json();
  assert.equal(body.otherSessionsSignedOut, true);
  assert.ok(Number.isFinite(Date.parse(body.passwordChangedAt)));
  assert.doesNotMatch(JSON.stringify(body), /password_hash|session_version|scrypt/);
  assert.equal((await me()).status, 401);
  assert.equal((await me(explicitVersionZero)).status, 401);
  const rotated = response.headers.get('set-cookie').split(';')[0];
  assert.equal(jwt.verify(rotated.split('=')[1], secret).sv, 1);
  assert.equal((await me(rotated)).status, 200);
  assert.equal((await login(currentPassword)).status, 401);
  assert.equal((await login(nextPassword)).status, 200);
});

test('sign-out all verifies the password, preserves credentials and invalidates every older token including legacy tokens', async t => {
  const { request, row, me, cookie, login } = await fixture(t);
  assert.equal((await request('signout-all', { currentPassword: 'wrong' })).status, 403);
  assert.equal((await me()).status, 200);
  const response = await request('signout-all', { currentPassword });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('set-cookie'), /finclear_auth=; Path=\/api; Expires=/);
  assert.equal(row().password_hash, hash);
  assert.equal(row().password_changed_at, null);
  assert.equal((await me()).status, 401);
  assert.equal((await me(cookie({ sv: 0, jti: 'second-browser' }))).status, 401);
  const signedIn = await login(currentPassword);
  assert.equal(signedIn.status, 200);
  assert.equal((await me(signedIn.headers.get('set-cookie').split(';')[0])).status, 200);
});

test('malformed session versions fail closed while legacy tokens remain compatible only at version zero', async t => {
  const { me, cookie, request } = await fixture(t);
  assert.equal((await me()).status, 200);
  for (const sv of [-1, 0.5, '0', null, {}]) assert.equal((await me(cookie({ sv }))).status, 401);
  await request('signout-all', { currentPassword });
  assert.equal((await me()).status, 401);
});

test('session changes between authentication and the row lock prevent a stale request from changing credentials', async t => {
  const { request, row, queries } = await fixture(t, { stale: true });
  const response = await request('password', update);
  assert.equal(response.status, 401);
  assert.equal(row().password_hash, hash);
  assert.equal(queries.some(q => q.sql.startsWith('UPDATE')), false);
});

test('busy accounts and database failure roll back with no success cookie', async t => {
  for (const [failureCode, pattern, status] of [['55P03', 'FOR UPDATE', 409], [undefined, 'UPDATE users', 503]]) {
    await t.test(String(status), async t => {
      const { request, row, queries } = await fixture(t, { failure: sql => sql.includes(pattern), failureCode });
      const response = await request('password', update);
      assert.equal(response.status, status);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.equal(row().password_hash, hash);
      assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
      assert.equal(queries.some(q => q.sql === 'COMMIT'), false);
    });
  }
});

test('sensitive security attempts are limited without blocking security detail refreshes', async t => {
  const { request } = await fixture(t);
  for (let i = 0; i < 10; i++) assert.equal((await request('password', { ...update, newPassword: '' })).status, 400);
  assert.equal((await request('password', update)).status, 429);
  assert.equal((await request()).status, 200);
});
