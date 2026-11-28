const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { createApp } = require('./server');
const { hashPassword } = require('./auth');

const database = process.env.ACCOUNT_ACCESS_TEST_DATABASE;
const origin = 'http://localhost:5173';
const secret = 'integration-only-session-signing-key-at-least-32-bytes';
const password = 'Integration-test-only!2026';

async function fixture(t, options = {}) {
  assert.match(database, /^finclear_auth_test_[a-z0-9_]+$/);
  const pool = new Pool({ database });
  const links = [];
  const server = createApp(pool, {
    secret, origins: [origin], mailer: async (email, purpose, link) => links.push({ email, purpose, link }),
    ...options,
  }, { env: 'sandbox', clientId: 'fixture', secret: 'fixture', encryptionKey: 'ab'.repeat(32) }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await pool.end();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { pool, links, base, async request(path, body, cookie) {
    return fetch(base + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'manual',
      headers: { Origin: origin, 'Content-Type': 'application/json', 'X-Plaid-Environment': 'sandbox', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } };
}

function session(response) {
  const value = response.headers.getSetCookie().find(value => value.startsWith('finclear_auth='));
  assert.ok(value, 'A successful authentication operation issues a session cookie');
  return value.split(';')[0];
}

test('merged password, verification, security, recovery and privacy flows against PostgreSQL', { skip: !database }, async t => {
  const { pool, request, links } = await fixture(t);
  const email = 'merged-password@example.com';
  const signup = { fullName: 'Merged Password', email, password, confirmPassword: password, acceptedTerms: true };
  let cookie, owner;
  await t.test('signup keeps verification and duplicate-email rejection', async () => {
    const response = await request('auth/signup', signup);
    assert.equal(response.status, 201);
    cookie = session(response);
    const { user } = await response.json();
    owner = user.id;
    assert.equal(user.emailVerified, false);
    assert.equal((await request('auth/signup', signup)).status, 409);
    assert.equal((await request('plaid/accounts', undefined, cookie)).status, 403);
    const link = links.find(link => link.purpose === 'verify');
    assert.ok(link);
    const token = new URLSearchParams(new URL(link.link).hash.slice(1)).get('verify');
    assert.equal((await request('auth/verify-email', { token })).status, 204);
    assert.equal((await request('auth/verify-email', { token })).status, 400);
    assert.equal((await request('plaid/accounts', undefined, cookie)).status, 200);
  });
  await t.test('server plan checks remain effective after the merge', async () => {
    await pool.query("UPDATE users SET access_role='free' WHERE id=$1", [owner]);
    const permissions = await request('account/permissions', undefined, cookie);
    assert.equal(permissions.status, 200);
    assert.equal((await permissions.json()).monthlyReports, false);
    assert.equal((await request('account/report-access', undefined, cookie)).status, 403);
    await pool.query("UPDATE users SET access_role='premium' WHERE id=$1", [owner]);
    assert.equal((await request('account/report-access', undefined, cookie)).status, 204);
  });
  const changed = 'Changed-integration-only!2026';
  await t.test('password changes rotate this session and revoke older sessions', async () => {
    const wrong = await request('security/password', { currentPassword: 'incorrect', newPassword: changed, confirmPassword: changed }, cookie);
    assert.equal(wrong.status, 403);
    const response = await request('security/password', { currentPassword: password, newPassword: changed, confirmPassword: changed }, cookie);
    assert.equal(response.status, 200);
    assert.equal((await request('auth/me', undefined, cookie)).status, 401);
    cookie = session(response);
    assert.equal((await request('auth/me', undefined, cookie)).status, 200);
    assert.equal((await request('auth/login', { email, password })).status, 401);
    assert.equal((await request('auth/login', { email, password: changed })).status, 200);
  });
  const reset = 'Reset-integration-only!2026';
  await t.test('password recovery remains one-time and revokes the rotated session', async () => {
    assert.equal((await request('auth/forgot-password', { email })).status, 202);
    const link = links.find(link => link.purpose === 'reset');
    const token = new URLSearchParams(new URL(link.link).hash.slice(1)).get('reset');
    assert.equal((await request('auth/reset-password', { token, password: reset, confirmPassword: reset })).status, 204);
    assert.ok((await pool.query('SELECT password_changed_at FROM users WHERE id=$1', [owner])).rows[0].password_changed_at);
    assert.equal((await request('auth/reset-password', { token, password: reset, confirmPassword: reset })).status, 400);
    assert.equal((await request('auth/me', undefined, cookie)).status, 401);
    const login = await request('auth/login', { email, password: reset });
    assert.equal(login.status, 200);
    cookie = session(login);
  });
  await t.test('sign-out-all revokes the current session and permits a fresh login', async () => {
    assert.equal((await request('security/signout-all', { currentPassword: reset }, cookie)).status, 204);
    assert.equal((await request('auth/me', undefined, cookie)).status, 401);
    const login = await request('auth/login', { email, password: reset });
    assert.equal(login.status, 200);
    cookie = session(login);
  });
  await t.test('account export and deletion coexist with authentication token records', async () => {
    const response = await request('privacy/export', { password: reset }, cookie);
    assert.equal(response.status, 200);
    const exported = await response.json();
    assert.equal(exported.data.user.id, owner);
    assert.equal(exported.data.user.password_hash, undefined);
    assert.equal(exported.data.user.session_version, undefined);
    assert.equal((await request('privacy/delete-account', { email, password: reset, confirmation: 'DELETE' }, cookie)).status, 204);
    assert.equal((await request('auth/me', undefined, cookie)).status, 401);
    assert.equal(Number((await pool.query('SELECT count(*) FROM auth_tokens WHERE user_id=$1', [owner])).rows[0].count), 0);
  });
});

test('merged Google callbacks keep signup/login/collision behavior against PostgreSQL', { skip: !database }, async t => {
  let profile = { sub: 'merged-google-subject', email: 'merged-google@example.com', email_verified: true };
  const { request, pool, base } = await fixture(t, {
    google: { clientId: 'fixture-client', clientSecret: 'fixture-secret', redirectUri: origin + '/api/auth/google/callback' },
    fetcher: async url => ({ ok: true, json: async () => url.includes('oauth2.googleapis.com/token') ? { access_token: 'fixture-access' } : profile }),
  });
  async function callback(mode) {
    const start = await request('auth/google/start', { mode, acceptedTerms: mode === 'signup' });
    assert.equal(start.status, 200);
    const url = new URL((await start.json()).url);
    return fetch(base + '/api/auth/google/callback?code=fixture-code&state=' + url.searchParams.get('state'), {
      redirect: 'manual', headers: { Cookie: start.headers.getSetCookie()[0].split(';')[0] },
    });
  }
  const signup = await callback('signup');
  assert.equal(signup.headers.get('location'), origin + '/#onboarding');
  const cookie = session(signup);
  const me = await (await request('auth/me', undefined, cookie)).json();
  assert.equal(me.user.emailVerified, true);
  assert.equal((await (await request('security', undefined, cookie)).json()).signInMethod, 'google');
  assert.equal((await request('security/password', { currentPassword: password, newPassword: password + '!', confirmPassword: password + '!' }, cookie)).status, 409);
  assert.equal((await callback('login')).headers.get('location'), origin + '/');
  assert.equal(Number((await pool.query('SELECT count(*) FROM users WHERE google_subject=$1', [profile.sub])).rows[0].count), 1);
  profile = { ...profile, sub: 'unknown-google-subject', email: 'unknown-google@example.com' };
  assert.equal((await callback('login')).headers.get('location'), origin + '/#google-signup');
  assert.equal(Number((await pool.query('SELECT count(*) FROM users WHERE email=$1', [profile.email])).rows[0].count), 0);
  await pool.query("INSERT INTO users(first_name,email,password_hash,access_role) VALUES('Password Owner',$1,$2,'free')", ['collision@example.com', await hashPassword(password)]);
  profile = { ...profile, sub: 'collision-google-subject', email: 'collision@example.com' };
  assert.equal((await callback('signup')).headers.get('location'), origin + '/#google-email-conflict');
  assert.equal((await pool.query('SELECT google_subject FROM users WHERE email=$1', [profile.email])).rows[0].google_subject, null);
});
