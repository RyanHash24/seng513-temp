const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createApp } = require('./server');
const { monthRange, cycleAt, summarize } = require('./monthly-report');

test('reports validate calendar months, year rollover and anchored budget cycles', () => {
  assert.deepEqual(monthRange('2024-02'), { month: '2024-02', start: '2024-02-01', end: '2024-03-01' });
  assert.equal(monthRange('2026-12', new Date('2026-12-01T02:00:00Z'), 'America/Edmonton'), null);
  assert.equal(monthRange('2026-11', new Date('2026-12-01T02:00:00Z'), 'America/Edmonton').month, '2026-11');
  assert.equal(monthRange('2024-12').end, '2025-01-01');
  for (const invalid of ['2024-00', '2024-13', '0000-01', '9999-12', ['2024-02'], undefined]) {
    assert.equal(monthRange(invalid), null);
  }
  assert.deepEqual(cycleAt('2024-01-31', '2024-02-28'), { start: '2024-01-31', end: '2024-02-28' });
  assert.deepEqual(cycleAt('2024-01-31', '2024-02-29'), { start: '2024-02-29', end: '2024-03-30' });
  assert.equal(cycleAt('2024-03-01', '2024-02-29'), null);
});

test('refunds restore the budget, transfers stay separate, and amounts preserve exact cents', () => {
  const rows = [
    { kind: 'expense', cents: '-1025', currency: 'CAD', providerCategory: 'FOOD_AND_DRINK_GROCERIES' },
    { kind: 'refund', cents: '250', currency: 'CAD', providerCategory: 'FOOD_AND_DRINK_GROCERIES' },
    { kind: 'income', cents: '100000', currency: 'CAD' },
    { kind: 'transfer', cents: '-50000', currency: 'CAD' },
    { kind: 'expense', cents: '-999999999999999999', currency: 'USD' },
  ];
  const totals = summarize(rows);
  assert.equal(totals.get('CAD').categories.get('Food & drink').amount, 775n);
  assert.equal(totals.get('CAD').categories.get('Food & drink').subcategories.get('Groceries'), 775n);
  assert.equal(totals.get('CAD').income, 100000n);
  assert.equal(totals.get('CAD').transfers, -50000n);
  assert.equal(totals.get('USD').expenses, 999999999999999999n);
});

test('report downloads require verification and plan access and derive ownership from the session', async t => {
  const secret = 'monthly-report-test-secret-at-least-32-bytes';
  const owner = { id: '10000000-0000-0000-0000-000000000001', first_name: 'Report', last_name: 'Owner',
    email: 'owner@example.com', access_role: 'premium', email_verified_at: new Date(), session_version: 0 };
  let parameters;
  let unavailable = false;
  const pool = { query: async (sql, params) => {
    if (sql.includes('FROM users')) return { rows: [owner] };
    if (params) parameters = params;
    if (unavailable) throw new Error('Database unavailable');
    return { rows: [] };
  } };
  pool.connect = async () => ({ query: pool.query, release() {} });
  const server = createApp(pool, { secret }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api/reports/monthly`;
  const cookie = 'finclear_auth=' + jwt.sign({ sv: 0 }, secret, { algorithm: 'HS256', subject: owner.id,
    issuer: 'finclear', audience: 'finclear-web', expiresIn: '1m' });
  const headers = { Cookie: cookie, 'X-Plaid-Environment': 'sandbox' };
  assert.equal((await fetch(`${base}?month=2024-02`)).status, 401);
  assert.equal((await fetch(`${base}?month=2024-13`, { headers })).status, 400);
  assert.equal(parameters, undefined);
  assert.equal((await fetch(`${base}?month=2024-02`, { headers: { Cookie: cookie } })).status, 409);
  const response = await fetch(`${base}?month=2024-02&userId=another-user`, { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(parameters, [owner.id, 'sandbox', '2024-02-01', '2024-03-01', 'UTC']);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition'), /attachment; filename="FinClear_Monthly_Budget_2024-02.pdf"/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
  owner.access_role = 'free';
  assert.equal((await fetch(`${base}?month=2024-02`, { headers })).status, 403);
  owner.access_role = 'premium';
  owner.email_verified_at = null;
  assert.equal((await fetch(`${base}?month=2024-02`, { headers })).status, 403);
  owner.email_verified_at = new Date();
  unavailable = true;
  const failed = await fetch(`${base}?month=2024-02`, { headers });
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).error, 'Unable to generate your monthly report. Please try again.');
});

const database = process.env.ACCOUNT_ACCESS_TEST_DATABASE;
test('historical reports use the last plan saved before local month end, including plans with no accounts', { skip: !database }, async () => {
  assert.match(database, /^finclear_auth_test_[a-z0-9_]+$/);
  const { Pool } = require('pg');
  const { randomUUID } = require('node:crypto');
  const { readReportBudget } = require('./monthly-report');
  const pool = new Pool({ database });
  const client = await pool.connect();
  const owner = randomUUID();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO users(id,first_name,last_name,email,password_hash,access_role)
      VALUES($1,'Historical','Fixture',$2,repeat('x',64),'free')`, [owner, owner + '@example.invalid']);
    for (const [revision, savedAt, limit] of [[1, '2024-10-20T00:00Z', 90000],
      [2, '2024-11-01T01:00Z', 100000], [3, '2024-11-02T00:00Z', 110000]]) {
      await client.query(`INSERT INTO monthly_budget_plans(user_id, environment, revision, starts_on,
        limit_cents, categories, account_ids, saved_at) VALUES($1,'sandbox',$2,'2024-10-19',$3,$4,'{}',$5)`,
      [owner, revision, limit, JSON.stringify([{ name: 'Shopping', allocation: limit }]), savedAt]);
    }
    const month = monthRange('2024-10');
    const report = await readReportBudget(client, owner, 'sandbox', month, 'America/Edmonton');
    assert.equal(Number(report.budget), 100000);
    assert.deepEqual(report.cycle, { start: '2024-10-19', end: '2024-11-18' });
    assert.equal(report.asOf, '2024-10-31');
    assert.equal(report.spent, 0n);
    assert.equal(Number((await readReportBudget(client, owner, 'sandbox', month)).budget), 90000);
    assert.equal(await readReportBudget(client, owner, 'production', month), null);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
