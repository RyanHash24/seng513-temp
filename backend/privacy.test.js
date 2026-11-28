const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { readFileSync } = require('node:fs');
const { createAuth } = require('./auth');
const { createPrivacy, EXPORT_TABLES, DELETE_TABLES } = require('./privacy');
const { tokenCipher } = require('./plaid');

const owner = '10000000-0000-0000-0000-000000000002';
const other = '10000000-0000-0000-0000-000000000003';
const secret = 'test-only-privacy-session-key-at-least-32-bytes';
const origin = 'http://localhost:5173';
const encryptionKey = 'ab'.repeat(32);
const hash = readFileSync(`${__dirname}/../database/seed.sql`, 'utf8').match(/'morgan@example\.com', '(scrypt[^']+)'/)[1];
const credentials = { password: 'FinClearDemo!2026', email: 'morgan@example.com', confirmation: 'DELETE' };
const connection = (id, environment = 'sandbox') => ({ id, provider: 'plaid', provider_item_id: `item-${id}`,
  plaid_environment: environment, encrypted_token: tokenCipher(encryptionKey).encrypt(`access-${environment}-${id}`,
    `${owner}:${id}${environment === 'production' ? ':production' : ''}`) });

async function fixture(t, options = {}) {
  let exists = true;
  const queries = [], calls = [];
  const user = { id: owner, first_name: 'Morgan', last_name: 'Test', email: credentials.email, access_role: 'premium', password_hash: hash };
  const client = { release() { queries.push({ sql: 'RELEASE' }); }, async query(sql, params) {
    queries.push({ sql, params });
    if (options.failure?.(sql)) throw Object.assign(new Error('Private database failure'), { code: options.failureCode });
    if (sql.startsWith('SELECT') && sql.includes('FROM users WHERE id=')) return { rows: exists ? [user] : [] };
    if (sql.includes('LEFT JOIN plaid_item_secrets')) return { rows: options.connections || [] };
    if (sql.startsWith('SELECT') && sql.includes('FROM transactions WHERE')) return { rows: Array.from({ length: 251 }, (_, id) => ({ id, amount: '-10.25' })) };
    if (sql.startsWith('DELETE FROM users')) return { rowCount: 1, rows: [{ id: owner }] };
    if (sql === 'COMMIT' && queries.some(q => q.sql.startsWith('DELETE FROM users'))) exists = false;
    return { rows: [] };
  } };
  const pool = { connect: async () => client, query: async (sql, params) => ({ rows: exists && params?.[0] === owner ? [user] : [] }) };
  const auth = createAuth(pool, { secret, origins: [origin] });
  const app = express(); app.use(express.json());
  app.use('/api/auth', auth.router);
  app.use('/api/privacy', createPrivacy(pool, auth.requireAuth, { origins: [origin], clearSession: auth.clearSession,
    plaid: { env: 'sandbox', clientId: 'fake-client', sandboxSecret: 'fake-sandbox', productionSecret: 'never-use-live-secret', encryptionKey, ...options.plaid },
    fetchImpl: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return options.fetchImpl ? options.fetchImpl(calls.length) : Response.json({ request_id: 'test-removal' });
    },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = subject => `finclear_auth=${jwt.sign({}, secret, { issuer: 'finclear', audience: 'finclear-web', subject, expiresIn: '15m' })}`;
  return { calls, queries, async request(path, body = credentials, headers = {}) {
    return fetch(`${base}/api/privacy/${path}`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie(owner), ...headers }, body: JSON.stringify(body) });
  }, async me(subject = owner) { return fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie(subject) } }); } };
}

test('privacy routes reject missing sessions, foreign origins and invalid bodies before accessing records', async t => {
  const { request, queries } = await fixture(t);
  assert.equal((await request('export', credentials, { Cookie: '' })).status, 401);
  assert.equal((await request('export', credentials, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await request('export', credentials, { 'Content-Type': 'text/plain' })).status, 403);
  for (const password of [null, 12, '', 'a'.repeat(1025)]) assert.equal((await request('export', { password })).status, 400);
  assert.equal(queries.length, 0);
});

test('complete account export requires the current password, excludes credentials and uses only owner-scoped queries', async t => {
  const { request, queries } = await fixture(t);
  assert.equal((await request('export', { password: 'incorrect' })).status, 403);
  const response = await request('export', { ...credentials, userId: other });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /attachment; filename="?finclear-account-.*\.json"?/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.data.user.id, owner);
  assert.equal(body.data.transactions.length, 251);
  assert.equal(body.data.user.password_hash, undefined);
  assert.equal(JSON.stringify(body).includes(hash), false);
  for (const [name, table] of EXPORT_TABLES) {
    assert.ok(Array.isArray(body.data[name]));
    const query = queries.find(q => q.sql.includes(`FROM ${table} WHERE user_id=$1`));
    assert.deepEqual(query.params, [owner]);
    assert.doesNotMatch(query.sql, /LIMIT|SELECT \*|encrypted_|password_hash|sync_cursor|secret_ref/);
  }
  assert.ok(queries.some(q => q.sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
});

test('export failures roll back and return no partial export or sensitive database details', async t => {
  const { request, queries } = await fixture(t, { failure: sql => sql.includes('FROM categories WHERE') });
  const response = await request('export');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('content-disposition'), null);
  assert.deepEqual(await response.json(), { error: 'Unable to export your account data. Please try again.' });
  assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
  assert.equal(queries.at(-1).sql, 'RELEASE');
});

test('deletion requires exact confirmation, the authenticated email and a valid current password', async t => {
  const { request, queries, calls } = await fixture(t);
  for (const change of [{ confirmation: 'delete' }, { confirmation: '' }, { email: 'other@example.com' }, { email: null }]) {
    assert.equal((await request('delete-account', { ...credentials, ...change })).status, 400);
  }
  assert.equal((await request('delete-account', { ...credentials, password: 'incorrect' })).status, 403);
  assert.equal(calls.length, 0);
  assert.equal(queries.some(q => q.sql.startsWith('DELETE')), false);
});

test('deletion removes only owned rows in dependency order, clears the cookie and invalidates old sessions', async t => {
  const { request, queries, calls, me } = await fixture(t, { connections: [connection('bank-one')] });
  assert.equal((await me()).status, 200);
  const response = await request('delete-account', { ...credentials, userId: other });
  assert.equal(response.status, 204);
  assert.match(response.headers.get('set-cookie'), /finclear_auth=; Path=\/api; Expires=/);
  assert.equal((await me()).status, 401);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://sandbox.plaid.com/item/remove');
  assert.equal(calls[0].body.secret, 'fake-sandbox');
  assert.match(calls[0].body.access_token, /^access-sandbox-/);
  const deletions = queries.filter(q => q.sql.startsWith('DELETE'));
  assert.deepEqual(deletions.map(q => q.sql.match(/^DELETE FROM (\w+)/)[1]), [...DELETE_TABLES, 'users']);
  for (const query of deletions) assert.deepEqual(query.params, [owner]);
});

test('an already removed Plaid Item is safe to retry without skipping database deletion', async t => {
  const { request, queries } = await fixture(t, { connections: [connection('already-removed')],
    fetchImpl: () => Response.json({ error_code: 'ITEM_NOT_FOUND' }, { status: 400 }) });
  assert.equal((await request('delete-account')).status, 204);
  assert.ok(queries.some(q => q.sql.startsWith('DELETE FROM users')));
});

test('every connection is preflighted before any removal; live links never reach a live or Sandbox endpoint', async t => {
  const { request, queries, calls } = await fixture(t, { connections: [connection('bank-one'), connection('live-bank', 'production')] });
  const response = await request('delete-account');
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /live bank connection/);
  assert.equal(calls.length, 0);
  assert.equal(queries.some(q => q.sql.startsWith('DELETE')), false);
});

test('missing Sandbox credentials, missing secrets and wrong encryption ownership block removal', async t => {
  for (const options of [{ plaid: { sandboxSecret: '', secret: '' }, connections: [connection('bank-one')] },
    { connections: [{ ...connection('bank-one'), encrypted_token: null }] },
    { connections: [{ ...connection('bank-one'), encrypted_token: tokenCipher(encryptionKey).encrypt('access-sandbox-x', `${other}:bank-one`) }] }]) {
    await t.test('preflight failure', async t => {
      const { request, queries, calls } = await fixture(t, options);
      assert.equal((await request('delete-account')).status, 503);
      assert.equal(calls.length, 0);
      assert.equal(queries.some(q => q.sql.startsWith('DELETE')), false);
    });
  }
});

test('bank failure after a partial disconnect preserves database rows and explains safe retry', async t => {
  const { request, queries, calls } = await fixture(t, { connections: [connection('one'), connection('two')],
    fetchImpl: count => count === 1 ? Response.json({ request_id: 'removed-one' }) : Response.json({ error_code: 'INTERNAL_SERVER_ERROR' }, { status: 500 }) });
  const response = await request('delete-account');
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Some bank links may already be disconnected/);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(calls.length, 2);
  assert.equal(queries.some(q => q.sql.startsWith('DELETE')), false);
  assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
});

test('a busy bank operation blocks deletion before external changes, and database failure rolls back without success', async t => {
  await t.test('row lock conflict', async t => {
    const { request, calls } = await fixture(t, { failure: sql => sql.includes('FOR UPDATE OF b'), failureCode: '55P03' });
    assert.equal((await request('delete-account')).status, 409);
    assert.equal(calls.length, 0);
  });
  await t.test('database failure', async t => {
    const { request, queries } = await fixture(t, { failure: sql => sql.startsWith('DELETE FROM categories') });
    const response = await request('delete-account');
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.ok(queries.some(q => q.sql === 'ROLLBACK'));
    assert.equal(queries.some(q => q.sql === 'COMMIT'), false);
  });
});

test('privacy attempts are rate limited per signed-in account', async t => {
  const { request } = await fixture(t);
  for (let i = 0; i < 10; i++) assert.equal((await request('delete-account', { ...credentials, confirmation: '' })).status, 400);
  assert.equal((await request('delete-account')).status, 429);
});
