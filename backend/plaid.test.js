const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createAuth } = require('./auth');
const { createPlaid, tokenCipher, accountType } = require('./plaid');

const owner = '10000000-0000-0000-0000-000000000002';
const connection = '20000000-0000-0000-0000-000000000002';
const signingKey = 'test-only-session-key-for-plaid-at-least-32-bytes';
const config = { env: 'sandbox', clientId: 'test-client', secret: 'test-secret', encryptionKey: 'ab'.repeat(32) };
const cookie = `finclear_auth=${jwt.sign({}, signingKey, { subject: owner, issuer: 'finclear', audience: 'finclear-web', expiresIn: '15m' })}`;

test('Plaid account subtypes map to the database account types', () => {
  for (const [subtype, expected] of [['checking', 'chequing'], ['savings', 'savings'], ['cd', 'savings'],
    ['money market', 'savings'], ['cash management', 'cash'], ['hsa', 'savings'], ['unknown', 'other']]) {
    assert.equal(accountType({ type: 'depository', subtype }), expected);
  }
  assert.equal(accountType({ type: 'investment', subtype: 'tfsa' }), 'investment');
  assert.equal(accountType({ type: 'credit' }), 'credit_card');
  assert.equal(accountType({ type: 'loan' }), 'loan');
});

async function fixture(t, options = {}) {
  const queries = [], calls = [], sessions = new Map();
  const environment = options.config?.env || 'sandbox';
  const savedEnvironment = options.savedEnvironment || environment;
  const responseEnvironment = options.responseEnvironment || environment;
  const ownerContext = `${owner}:${connection}${savedEnvironment === 'production' ? ':production' : ''}`;
  const databaseQuery = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('SELECT access_role, trial_ends_at')) return { rows: [{ access_role: options.accessRole || 'premium',
      email_verified_at: options.emailVerified === false ? null : new Date() }] };
    if (sql.includes('SELECT count(*) FROM bank_connections')) return { rows: [{ count: options.bankConnectionCount || 0 }] };
    if (sql.includes('FROM users')) return { rows: [{ id: params[0], access_role: 'premium' }] };
    if (sql.includes('INSERT INTO plaid_link_sessions')) {
      sessions.set(params[0], { id: params[0], user_id: params[1], mode: params[2], connection_id: params[3], encrypted_link_token: params[4], expires_at: params[5], plaid_environment: params[6], requested_product: params[7] });
    }
    if (sql.includes('SELECT * FROM plaid_link_sessions')) {
      const session = sessions.get(params[0]);
      return { rows: session && session.user_id === params[1] && session.mode === params[2] && session.plaid_environment === params[3] ? [session] : [] };
    }
    if (sql.includes('UPDATE plaid_link_sessions')) {
      const isNew = sql.includes('connection_id=$1');
      const session = sessions.get(params[isNew ? 1 : 0]);
      if (sql.includes('completed_at=now()')) session.completed_at = new Date();
      if (isNew) session.connection_id = params[0];
    }
    if (sql.includes('b.provider_item_id') && sql.includes('JOIN plaid_item_secrets')) {
      return { rows: options.savedBank && params[0] === connection && params[1] === owner && params[2] === savedEnvironment ? [{ id: connection, user_id: owner, provider_item_id: 'item-test',
        plaid_environment: savedEnvironment, provider_institution_id: 'test-bank',
        encrypted_token: tokenCipher(config.encryptionKey).encrypt(`access-${options.tokenEnvironment || savedEnvironment}-private`, ownerContext) }] : [] };
    }
    if (sql.includes('provider_institution_id=$2 OR')) return { rows: options.duplicate && params[2] === savedEnvironment ? [{ id: connection }] : [] };
    if (options.failSave && sql.includes('INSERT INTO accounts')) throw new Error('Save failed');
    if (sql.includes('INSERT INTO accounts')) return { rows: [{ id: 'saved-account' }] };
    return { rows: sql.includes('INSERT INTO bank_connections') ? [{ id: connection }] : [] };
  };
  const pool = { query: databaseQuery, connect: async () => ({ query: databaseQuery, release() {} }) };
  const api = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, body });
    if (options.failApi) return { ok: false, json: async () => ({ secret: 'must not leak' }) };
    let data = {};
    if (url.endsWith('/link/token/create')) data = { link_token: `link-${responseEnvironment}-test`, expiration: new Date(Date.now()+600000).toISOString() };
    if (url.endsWith('/item/get')) data = { item: { item_id: 'item-test', institution_id: 'test-bank', consented_products: options.investmentConsent === false ? ['transactions'] : ['transactions', 'investments'], error: options.loginRequired ? { error_code: 'ITEM_LOGIN_REQUIRED' } : null } };
    if (url.endsWith('/link/token/get')) {
      const result = { public_token: `public-${responseEnvironment}-test`, institution: { institution_id: 'test-bank', name: 'Test Bank' }, accounts: [{ id: 'account-test' }] };
      data = { link_sessions: options.noResult ? [] : [options.legacy ? { on_success: { public_token: result.public_token, metadata: { institution: result.institution, accounts: result.accounts } } } : { results: { item_add_results: [result] } }] };
    }
    if (url.endsWith('/item/public_token/exchange')) data = { access_token: `access-${responseEnvironment}-private`, item_id: 'item-test' };
    if (url.endsWith('/accounts/get')) data = { accounts: [{ account_id: 'account-test', name: 'Test chequing', type: 'depository', subtype: 'checking', mask: '1234', balances: { iso_currency_code: 'CAD', current: 100, available: 90 } }], item: { institution_id: 'test-bank' } };
    if (url.endsWith('/institutions/get_by_id')) data = { institution: { name: 'Test Bank', products: options.noInvestments ? ['transactions'] : ['transactions', 'investments'] } };
    return { ok: true, json: async () => data };
  };
  const app = express(); app.use(express.json());
  const auth = createAuth(pool, { secret: signingKey });
  app.use('/api/plaid', createPlaid(pool, auth.requireAuth, { ...config, ...options.config }, api));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (path, body, headers = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/plaid/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'http://localhost:5173', Cookie: cookie,
      'Content-Type': 'application/json', 'X-Plaid-Environment': environment, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  async function exchange() {
    const response = await request('link-token', {});
    const { sessionId } = await response.json();
    return request('exchange', { publicToken: `public-${environment}-test`, accountIds: ['account-test'], sessionId, userId: 'other-user' });
  }
  return { request, queries, calls, sessions, exchange };
}

test('Plaid token encryption detects tampering and binds ciphertext to the owner and connection', () => {
  const cipher = tokenCipher(config.encryptionKey);
  const encrypted = cipher.encrypt('private-token', `${owner}:${connection}`);
  assert.equal(encrypted.includes('private-token'), false);
  assert.equal(cipher.decrypt(encrypted, `${owner}:${connection}`), 'private-token');
  assert.throws(() => cipher.decrypt(encrypted, 'other-user'));
  const tampered = Buffer.from(encrypted, 'base64'); tampered[28] ^= 1;
  assert.throws(() => cipher.decrypt(tampered.toString('base64'), `${owner}:${connection}`));
  assert.throws(() => tokenCipher('weak'));
});

test('Plaid routes require a session, trusted origin and Sandbox configuration', async t => {
  const { request } = await fixture(t);
  assert.equal((await request('accounts', undefined, { Cookie: '' })).status, 401);
  assert.equal((await request('link-token', {}, { Origin: 'https://other.example' })).status, 403);
  const unconfigured = await fixture(t, { config: { env: 'production' } });
  assert.equal((await unconfigured.request('link-token', {})).status, 503);
});

test('Link tokens use the authenticated user and return only the temporary token', async t => {
  const { request, calls } = await fixture(t);
  const response = await request('link-token', { userId: 'other-user' });
  const data = await response.json();
  assert.equal(data.linkToken, 'link-sandbox-test');
  assert.match(data.sessionId, /^[a-f0-9-]{36}$/);
  assert.equal(data.accessToken, undefined);
  assert.equal(calls[0].body.user.client_user_id, owner);
  assert.deepEqual(calls[0].body.products, ['transactions']);
});

test('exchange saves selected accounts for the authenticated owner and encrypts the bank token', async t => {
  const { exchange, queries } = await fixture(t);
  const response = await exchange();
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { connectionId: connection, accountCount: 1 });
  const account = queries.find(q => q.sql.includes('INSERT INTO accounts'));
  assert.equal(account.params[0], owner); assert.equal(account.params[3], 'chequing');
  const encrypted = queries.find(q => q.sql.includes('INSERT INTO plaid_item_secrets')).params[1];
  assert.equal(tokenCipher(config.encryptionKey).decrypt(encrypted, `${owner}:${connection}`), 'access-sandbox-private');
  assert.equal(queries.some(q => q.sql === 'COMMIT'), true);
});

test("new bank connections enforce the authenticated user's plan quota", async t => {
  const { exchange, calls, queries } = await fixture(t, { accessRole: 'free', bankConnectionCount: 1 });
  assert.equal((await exchange()).status, 403);
  assert.equal(calls.some(call => call.url.endsWith('/item/public_token/exchange')), false);
  assert.equal(queries.some(query => query.sql.includes('INSERT INTO bank_connections')), false);
  assert.equal(queries.some(query => query.sql === 'ROLLBACK'), true);
});

test('failed account saves roll back and remove the newly exchanged Sandbox Item', async t => {
  const { exchange, queries, calls } = await fixture(t, { failSave: true });
  assert.equal((await exchange()).status, 502);
  assert.equal(queries.some(q => q.sql === 'ROLLBACK'), true);
  assert.equal(queries.some(q => q.sql === 'COMMIT'), false);
  assert.equal(calls.at(-1).url.endsWith('/item/remove'), true);
});

test('invalid exchange input is rejected before calling Plaid, and upstream errors are generic', async t => {
  const { request, calls } = await fixture(t);
  assert.equal((await request('exchange', { publicToken: 'public-production-test', accountIds: ['account-test'] })).status, 400);
  assert.equal(calls.length, 0);
  const failed = await fixture(t, { failApi: true });
  const response = await failed.request('link-token', {});
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes('must not leak'), false);
});

test('linked account reads filter by authenticated ownership and return no bank token', async t => {
  const { request, queries } = await fixture(t);
  const response = await request('accounts');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { accounts: [] });
  const query = queries.find(q => q.sql.includes('FROM accounts'));
  assert.deepEqual(query.params, [owner, 'sandbox']);
  assert.equal(query.sql.includes('a.user_id=$1'), true);
  assert.equal(query.sql.includes('encrypted_token'), false);
});


test('duplicate banks are rejected using Plaid-verified metadata before requesting an access token', async t => {
  const { exchange, calls } = await fixture(t, { duplicate: true });
  const response = await exchange();
  assert.equal(response.status, 409);
  assert.equal((await response.json()).connectionId, connection);
  assert.equal(calls.some(call => call.url.endsWith('/item/public_token/exchange')), false);
});

test('unconfirmed Link results fail closed and cannot consume an Item', async t => {
  const { exchange, calls } = await fixture(t, { noResult: true });
  assert.equal((await exchange()).status, 409);
  assert.equal(calls.some(call => call.url.endsWith('/item/public_token/exchange')), false);
});

test('legacy Link results are verified and successful exchange retries reuse the saved connection', async t => {
  const { exchange, request, sessions, calls } = await fixture(t, { legacy: true });
  assert.equal((await exchange()).status, 201);
  const sessionId = [...sessions.keys()][0];
  const retry = await request('exchange', { sessionId, publicToken: 'public-sandbox-test', accountIds: ['account-test'] });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).alreadySaved, true);
  assert.equal(calls.filter(call => call.url.endsWith('/item/public_token/exchange')).length, 1);
});

test('sessions cannot be used by another user or after expiration', async t => {
  const { request, sessions, calls } = await fixture(t);
  const { sessionId } = await (await request('link-token', {})).json();
  const body = { sessionId, publicToken: 'public-sandbox-test', accountIds: ['account-test'] };
  const otherCookie = `finclear_auth=${jwt.sign({}, signingKey, { subject: '10000000-0000-0000-0000-000000000004', issuer: 'finclear', audience: 'finclear-web', expiresIn: '15m' })}`;
  assert.equal((await request('exchange', body, { Cookie: otherCookie })).status, 404);
  sessions.get(sessionId).expires_at = new Date(0);
  assert.equal((await request('exchange', body)).status, 410);
  assert.equal(calls.some(call => call.url.endsWith('/item/public_token/exchange')), false);
});

test('update mode preserves the Item and token and never invokes token exchange', async t => {
  const { request, calls, queries } = await fixture(t, { savedBank: true });
  const start = await request('link-token', { connectionId: connection });
  assert.equal(start.status, 200);
  const { sessionId } = await start.json();
  const configRequest = calls.find(call => call.url.endsWith('/link/token/create')).body;
  assert.equal(configRequest.access_token, 'access-sandbox-private');
  assert.equal(configRequest.products, undefined);
  const complete = await request('update', { sessionId });
  assert.equal(complete.status, 200);
  assert.equal((await complete.json()).connectionId, connection);
  assert.equal(calls.some(call => call.url.endsWith('/item/public_token/exchange')), false);
  assert.equal(queries.some(query => query.sql.includes('INSERT INTO bank_connections')), false);
  assert.equal(queries.some(query => query.sql.includes('INSERT INTO plaid_item_secrets')), false);
  assert.equal((await request('update', { sessionId })).status, 200);
});

test('update mode rejects another user connection and unresolved login errors', async t => {
  const { request, calls } = await fixture(t);
  assert.equal((await request('link-token', { connectionId: connection })).status, 404);
  assert.equal(calls.length, 0);
  const broken = await fixture(t, { savedBank: true, loginRequired: true });
  const { sessionId } = await (await broken.request('link-token', { connectionId: connection })).json();
  assert.equal((await broken.request('update', { sessionId })).status, 409);
  assert.equal(broken.queries.some(query => query.sql.includes("SET status='connected'")), false);
});

test('investment consent uses the saved Item without a new exchange and verifies consent before completion', async t => {
  const { request, calls, queries } = await fixture(t, { savedBank: true });
  const { sessionId } = await (await request('link-token', { connectionId: connection, product: 'investments' })).json();
  const link = calls.find(call => call.url.endsWith('/link/token/create')).body;
  assert.equal(link.access_token, 'access-sandbox-private');
  assert.deepEqual(link.additional_consented_products, ['investments']);
  assert.equal(link.products, undefined);
  assert.equal((await request('update', { sessionId })).status, 200);
  assert.equal(calls.some(call => call.url.endsWith('/item/public_token/exchange')), false);
  assert.equal(queries.some(query => query.sql.includes('INSERT INTO bank_connections')), false);
  const missing = await fixture(t, { savedBank: true, investmentConsent: false });
  const missingSession = await (await missing.request('link-token', { connectionId: connection, product: 'investments' })).json();
  assert.equal((await missing.request('update', { sessionId: missingSession.sessionId })).status, 409);
  assert.equal(missing.sessions.get(missingSession.sessionId).completed_at, undefined);
});

test('new investment Link sessions initialize Investments and reject arbitrary products', async t => {
  const { request, calls } = await fixture(t);
  assert.equal((await request('link-token', { product: 'arbitrary' })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await request('link-token', { product: 'investments' })).status, 200);
  assert.deepEqual(calls.at(-1).body.products, ['investments']);
});

test('unsupported investment institutions fail before opening update mode and keep the saved Item', async t => {
  const { request, calls } = await fixture(t, { savedBank: true, noInvestments: true });
  assert.equal((await request('link-token', { connectionId: connection, product: 'investments' })).status, 409);
  assert.equal(calls.some(call => call.url.endsWith('/link/token/create')), false);
  assert.equal(calls.some(call => call.url.endsWith('/item/remove')), false);
});

test('Sandbox is the default and a distinct Sandbox secret takes precedence over the legacy setting', async t => {
  const { request, calls } = await fixture(t, { config: { env: undefined, sandboxSecret: 'sandbox-only-secret', productionSecret: 'production-only-secret' } });
  assert.deepEqual(await (await request('status')).json(), { environment: 'sandbox', configured: true });
  assert.equal((await request('link-token', {})).status, 200);
  assert.equal(calls[0].url, 'https://sandbox.plaid.com/link/token/create');
  assert.equal(calls[0].body.secret, 'sandbox-only-secret');
});

test('Production requires explicit enablement and a separate secret; unknown environments fail closed', async t => {
  for (const override of [
    { env: 'production', productionSecret: 'live-test-secret' },
    { env: 'production', productionEnabled: true },
    { env: 'production', productionEnabled: 'true', productionSecret: 'live-test-secret' },
    { env: 'development', productionEnabled: true, productionSecret: 'live-test-secret' },
    { env: '', productionEnabled: true, productionSecret: 'live-test-secret' },
  ]) {
    const { request, calls } = await fixture(t, { config: override });
    assert.equal((await (await request('status')).json()).configured, false);
    assert.equal((await request('link-token', {})).status, 503);
    assert.equal(calls.length, 0);
  }
});

test('stale and missing environment headers cannot read data or start bank operations', async t => {
  const { request, calls, queries } = await fixture(t);
  for (const header of ['production', '']) {
    for (const path of ['accounts', 'connections', 'transactions']) {
      assert.equal((await request(path, undefined, { 'X-Plaid-Environment': header })).status, 409);
    }
    assert.equal((await request('link-token', {}, { 'X-Plaid-Environment': header })).status, 409);
  }
  assert.equal(calls.length, 0);
  assert.equal(queries.some(query => query.sql.includes('FROM accounts')), false);
});

test('Production routing uses only the Production host and secret and scopes new rows to Production', async t => {
  const { exchange, calls, queries } = await fixture(t, { config: {
    env: 'production', productionEnabled: true, productionSecret: 'live-test-secret', sandboxSecret: 'sandbox-test-secret',
  }, duplicate: true, savedEnvironment: 'sandbox' });
  assert.equal((await exchange()).status, 201);
  assert.ok(calls.length > 0);
  assert.equal(calls.every(call => call.url.startsWith('https://production.plaid.com/') && call.body.secret === 'live-test-secret'), true);
  assert.equal(queries.find(query => query.sql.includes('INSERT INTO plaid_link_sessions')).params[6], 'production');
  assert.equal(queries.find(query => query.sql.includes('INSERT INTO bank_connections')).params[4], 'production');
  const encrypted = queries.find(query => query.sql.includes('INSERT INTO plaid_item_secrets')).params[1];
  assert.equal(tokenCipher(config.encryptionKey).decrypt(encrypted, `${owner}:${connection}:production`), 'access-production-private');
  assert.throws(() => tokenCipher(config.encryptionKey).decrypt(encrypted, `${owner}:${connection}`));
});

test('saved connections and linking sessions from another environment are rejected before any Plaid call', async t => {
  const { request, calls, sessions } = await fixture(t, { savedBank: true, savedEnvironment: 'production' });
  assert.equal((await request('link-token', { connectionId: connection })).status, 404);
  assert.equal((await request('sync', { connectionId: connection })).status, 404);
  assert.equal(calls.length, 0);
  const { sessionId } = await (await request('link-token', {})).json();
  sessions.get(sessionId).plaid_environment = 'production';
  const count = calls.length;
  assert.equal((await request('exchange', { sessionId, publicToken: 'public-sandbox-test', accountIds: ['account-test'] })).status, 404);
  assert.equal(calls.length, count);
});

test('corrupted cross-environment stored tokens and wrong-environment upstream link tokens are never used', async t => {
  const corrupted = await fixture(t, { savedBank: true, tokenEnvironment: 'production' });
  assert.equal((await corrupted.request('link-token', { connectionId: connection })).status, 502);
  assert.equal(corrupted.calls.length, 0);
  const wrongResponse = await fixture(t, { responseEnvironment: 'production' });
  assert.equal((await wrongResponse.request('link-token', {})).status, 502);
  assert.equal(wrongResponse.sessions.size, 0);
});

test('all account, connection and transaction reads filter by the server environment', async t => {
  const { request, queries } = await fixture(t, { config: { env: 'production', productionEnabled: true, productionSecret: 'live-test-secret' } });
  for (const path of ['accounts', 'connections', 'transactions']) assert.equal((await request(path)).status, 200);
  const reads = queries.filter(query => /FROM accounts a|FROM transactions t|FROM bank_connections b JOIN/.test(query.sql));
  assert.equal(reads.length, 3);
  assert.equal(reads.every(query => {
    const parameter = query.sql.match(/b\.plaid_environment=\$(\d+)/);
    return parameter && query.params[Number(parameter[1]) - 1] === 'production';
  }), true);
});
