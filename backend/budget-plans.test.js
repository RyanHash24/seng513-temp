const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { createApp } = require('./server');
const { hashPassword } = require('./auth');
const { validatedPlan } = require('./budget-plans');

const plan = { start: '2026-11-19', budget: 50000, accountIds: [],
  categories: [{ id: 4, name: 'Shopping', allocation: 50000, targets: [{ name: 'Shoes', cents: 50000 }] }] };

test('plan validation uses integer cents at both allocation levels and accepts category-only allocations', () => {
  assert.deepEqual(validatedPlan(plan), plan);
  for (const budget of [49999, 50001, 0, 50000.1, '50000', Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => validatedPlan({ ...plan, budget }));
  for (const start of ['0000-01-01', '2026-02-29', '2026-11-31'])
    assert.throws(() => validatedPlan({ ...plan, start }));
  assert.doesNotThrow(() => validatedPlan({ ...plan, start: '2028-02-29' }));
  for (const cents of [-1, 49999, 50001, 50000.1])
    assert.throws(() => validatedPlan({ ...plan, categories: [{ ...plan.categories[0], targets: [{ name: 'Shoes', cents }] }] }));
  assert.throws(() => validatedPlan({ ...plan, categories: [plan.categories[0], { id: 5, name: ' shopping', allocation: 0 }] }));
  assert.deepEqual(validatedPlan({ ...plan, categories: [{ ...plan.categories[0], targets: undefined, subcategory: 'Shoes' }] }), plan);
  assert.doesNotThrow(() => validatedPlan({ ...plan, categories: [{ ...plan.categories[0], targets: [] }] }));
});

const database = process.env.ACCOUNT_ACCESS_TEST_DATABASE;
test('verified users save, replace and synchronize their own budget through the HTTP API', { skip: !database }, async t => {
  assert.match(database, /^finclear_auth_test_[a-z0-9_]+$/);
  const pool = new Pool({ database });
  const origin = 'http://localhost:5173';
  const server = createApp(pool, { secret: 'budget-plan-integration-tests-only-secret', origins: [origin] }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    await pool.end();
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const password = 'Budget-test-fixture!2026';
  const passwordHash = await hashPassword(password);
  async function login(email) {
    const response = await fetch(base + '/auth/login', { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    assert.equal(response.status, 200);
    return response.headers.getSetCookie()[0].split(';')[0];
  }
  async function user(role, verified = true) {
    const id = randomUUID(), email = id + '@example.com';
    await pool.query(`INSERT INTO users(id,first_name,email,password_hash,access_role,email_verified_at)
      VALUES($1,'Budget',$2,$3,$4,CASE WHEN $5 THEN now() END)`, [id, email, passwordHash, role, verified]);
    return { id, email, cookie: await login(email) };
  }
  async function account(userId, environment) {
    const { rows: [connection] } = await pool.query(`INSERT INTO bank_connections(user_id,institution_name,plaid_environment)
      VALUES($1,'Test bank',$2) RETURNING id`, [userId, environment]);
    const { rows: [account] } = await pool.query(`INSERT INTO accounts(user_id,connection_id,name,account_type,source,provider_account_id)
      VALUES($1,$2,'Test card','credit_card','plaid','card') RETURNING id`, [userId, connection.id]);
    return account.id;
  }
  const owner = await user('premium'), second = await user('free'), unverified = await user('free', false);
  const mobile = { ...owner, cookie: await login(owner.email) };
  const owned = await account(owner.id, 'sandbox'), foreign = await account(second.id, 'sandbox'), live = await account(owner.id, 'production');
  function request(actor, body, headers) {
    return fetch(base + '/budget-plan', { method: body ? 'PUT' : 'GET', headers: {
      Cookie: actor.cookie, 'X-FinClear-User': actor.id, 'Content-Type': 'application/json', Origin: origin, ...headers,
    }, body: body ? JSON.stringify(body) : undefined });
  }
  const save = (actor, revision, value) => request(actor, { revision, environment: 'sandbox', plan: value });
  const read = async actor => (await request(actor)).json();
  await t.test('owner, verification, origin and environment are enforced before saving', async () => {
    assert.equal((await request(owner, undefined, { Cookie: '' })).status, 401);
    assert.equal((await request(unverified)).status, 403);
    assert.equal((await request(owner, undefined, { 'X-FinClear-User': second.id })).status, 409);
    assert.equal((await request(owner, { revision: 0, environment: 'production', plan })).status, 409);
    assert.equal((await request(owner, { revision: 0, environment: 'sandbox', plan }, { Origin: 'https://other.example' })).status, 403);
    for (const id of [live, foreign, randomUUID()]) assert.equal((await save(owner, 0, { ...plan, accountIds: [id] })).status, 422);
    const categories = Array.from({ length: 4 }, (_, id) => ({ id, name: 'Group ' + id, allocation: 12500 }));
    assert.equal((await save(second, 0, { ...plan, categories })).status, 403);
    assert.equal((await read(owner)).revision, 0);
  });
  await t.test('create, edit and replacement reject a cent in either direction without modifying the saved revision', async () => {
    for (let revision = 0; revision < 3; revision++) {
      for (const offset of [-1, 1])
        assert.equal((await save(owner, revision, { ...plan, budget: plan.budget + offset })).status, 422);
      assert.equal((await read(mobile)).revision, revision);
      const next = { ...plan, start: ['2026-11-19', '2026-11-20', '2026-12-01'][revision],
        accountIds: revision === 0 ? [] : [owned] };
      const response = await save(owner, revision, next);
      assert.equal(response.status, 200);
      assert.deepEqual(await read(mobile), { environment: 'sandbox', plan: next, revision: revision + 1 });
      assert.equal((await save(owner, revision, next)).status, 200, 'retry after a lost response');
    }
    assert.equal((await read(second)).plan, null);
  });
  await t.test('concurrent edits preserve one winner and the previous revision', async () => {
    const edits = ['2026-12-02', '2026-12-03'].map(start => ({ ...plan, start }));
    const responses = await Promise.all([save(owner, 3, edits[0]), save(mobile, 3, edits[1])]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
    assert.deepEqual((await read(owner)).plan, edits[responses.findIndex(r => r.status === 200)]);
    const { rowCount } = await pool.query('SELECT revision FROM monthly_budget_plans WHERE user_id=$1', [owner.id]);
    assert.equal(rowCount, 4);
  });
});
