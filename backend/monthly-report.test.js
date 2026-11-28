const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createApp } = require('./server');
const { monthRange, budgetSnapshot, summarize } = require('./monthly-report');

test('reports validate calendar months, year rollover and budget allocations', () => {
  assert.deepEqual(monthRange('2024-02'), { month: '2024-02', start: '2024-02-01', end: '2024-03-01' });
  assert.equal(monthRange('2024-12').end, '2025-01-01');
  for (const invalid of ['2024-00', '2024-13', '0000-01', '9999-12', ['2024-02'], undefined]) {
    assert.equal(monthRange(invalid), null);
  }
  const range = monthRange('2024-02');
  const budget = { start: '2024-02-01', budget: 10000, categories: [{ name: 'Food', allocation: 10000 }],
    accountIds: ['10000000-0000-0000-0000-000000000001'] };
  assert.equal(budgetSnapshot(budget, range).budget, 10000);
  for (const change of [{ budget: 9999 }, { start: '2024-02-30' }, { start: '2024-03-01' },
    { accountIds: [] }, { accountIds: ['invalid'] }, { categories: [{ name: 'Food', allocation: -1 }] }]) {
    assert.throws(() => budgetSnapshot({ ...budget, ...change }, range));
  }
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
    parameters = params;
    if (unavailable) throw new Error('Database unavailable');
    return { rows: [] };
  } };
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
  assert.deepEqual(parameters, [owner.id, 'sandbox', '2024-02-01', '2024-03-01']);
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
