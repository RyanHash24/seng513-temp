const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { Pool } = require('pg');
const { createPlaid, tokenCipher } = require('./plaid');
const { investmentFields, fetchInvestmentActivity } = require('./plaid-investments');

const owner = '12000000-0000-0000-0000-000000000001';
const other = '12000000-0000-0000-0000-000000000002';
const connectionId = '22000000-0000-0000-0000-000000000001';
const accountId = '32000000-0000-0000-0000-000000000001';
const config = { env: 'sandbox', clientId: 'fake-client', secret: 'fake-secret', encryptionKey: 'ef'.repeat(32) };
const activity = (id, extra = {}) => ({ investment_transaction_id: id, account_id: 'investment-test',
  date: '2026-11-24', name: 'Test security purchase', type: 'buy', subtype: 'buy', amount: 25.25,
  iso_currency_code: 'CAD', quantity: 0.5, price: 50, fees: 0.25, security_id: 'security-test', ...extra });
const security = { security_id: 'security-test', name: 'Test Fund', ticker_symbol: 'TEST' };
const page = (transactions = [], total = transactions.length) => ({ investment_transactions: transactions,
  securities: [security], total_investment_transactions: total });

test('investment cash signs, fractions, null amounts and native currencies are preserved', () => {
  const securities = new Map([[security.security_id, security]]);
  const buy = investmentFields(activity('buy'), securities);
  assert.equal(buy.amount, '-25.25'); assert.equal(buy.quantity, '0.5'); assert.equal(buy.ticker, 'TEST');
  assert.equal(investmentFields(activity('sell', { amount: -100, type: 'sell' }), securities).amount, '100');
  assert.equal(investmentFields(activity('usd', { iso_currency_code: 'USD' }), securities).currency, 'USD');
  assert.equal(investmentFields(activity('null', { amount: null, quantity: null }), securities).amount, null);
  assert.equal(investmentFields(activity('zero', { amount: 0 }), securities).amount, '0');
  assert.throws(() => investmentFields(activity('invalid', { amount: NaN }), securities));
  assert.throws(() => investmentFields(activity('invalid', { amount: '10' }), securities));
});

test('investment pagination uses one token and filters saved accounts without a bank sync cursor', async () => {
  const calls = [], pages = [page([activity('one')], 2), page([activity('two')], 2)];
  const result = await fetchInvestmentActivity(async (path, body) => {
    calls.push({ path, body }); return pages.shift();
  }, { accessToken: 'access-sandbox-saved' }, ['investment-test'], '2024-11-25', '2026-11-25');
  assert.deepEqual(result.transactions.map(row => row.investment_transaction_id), ['one', 'two']);
  assert.deepEqual(calls.map(call => call.body.options.offset), [0, 1]);
  assert.ok(calls.every(call => call.path === '/investments/transactions/get' && call.body.access_token === 'access-sandbox-saved'));
  assert.deepEqual(calls[0].body.options.account_ids, ['investment-test']);
});

test('changing investment history restarts and malformed or stuck pages fail without a partial result', async () => {
  const pages = [page([activity('discard')], 2), page([activity('changed')], 3), page([activity('keep')])];
  const result = await fetchInvestmentActivity(async () => pages.shift(), {}, [], '2024-11-25', '2026-11-25');
  assert.deepEqual(result.transactions.map(row => row.investment_transaction_id), ['keep']);
  await assert.rejects(() => fetchInvestmentActivity(async () => page([], 1), {}, [], '2024-11-25', '2026-11-25'));
  await assert.rejects(() => fetchInvestmentActivity(async () => ({}), {}, [], '2024-11-25', '2026-11-25'));
});

test('investment syncing against PostgreSQL', { skip: !process.env.PLAID_INVESTMENTS_TEST_DATABASE }, async t => {
  assert.match(process.env.PLAID_INVESTMENTS_TEST_DATABASE, /^finclear_investments_test_[a-z0-9_]+$/);
  const pool = new Pool({ database: process.env.PLAID_INVESTMENTS_TEST_DATABASE });
  t.after(() => pool.end());
  await pool.query(`INSERT INTO users(id,first_name,email,password_hash,access_role) VALUES
    ($1,'Morgan','investment-morgan@example.com',repeat('x',64),'premium'),
    ($2,'Other','investment-other@example.com',repeat('x',64),'free')`, [owner, other]);
  await pool.query(`INSERT INTO bank_connections(id,user_id,institution_name,provider,provider_item_id,provider_institution_id,sync_cursor)
    VALUES($1,$2,'Test Investment Bank','plaid','investment-item','investment-bank','bank-cursor')`, [connectionId, owner]);
  await pool.query('INSERT INTO plaid_item_secrets(connection_id,encrypted_token) VALUES($1,$2)',
    [connectionId, tokenCipher(config.encryptionKey).encrypt('access-sandbox-saved', `${owner}:${connectionId}`)]);
  await pool.query(`INSERT INTO accounts(id,user_id,connection_id,name,account_type,source,provider_account_id,currency)
    VALUES($1,$2,$3,'Test TFSA','investment','plaid','investment-test','CAD')`, [accountId, owner, connectionId]);
  const calls = []; let responses = [];
  const api = async (url, init) => {
    assert.equal(url, 'https://sandbox.plaid.com/investments/transactions/get');
    const body = JSON.parse(init.body); calls.push(body);
    assert.equal(body.access_token, 'access-sandbox-saved');
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'Unexpected provider request');
    return { ok: !response.error_code, json: async () => response };
  };
  const app = express(); app.use(express.json());
  app.use('/api/plaid', createPlaid(pool, (req, res, next) => { req.user = { id: req.get('X-Test-User') || owner }; next(); }, config, api));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (path, body, user = owner, environment = 'sandbox') => fetch(`http://127.0.0.1:${server.address().port}/api/plaid/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json',
      'X-Test-User': user, 'X-Plaid-Environment': environment }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sync = (...pages) => { responses = pages; return request('investments/sync', { connectionId }); };
  const saved = async id => (await pool.query('SELECT * FROM investment_transactions WHERE provider_transaction_id=$1', [id])).rows[0];

  await t.test('multi-page import preserves mixed CAD/USD activity without adding budget spending or Items', async () => {
    const response = await sync(page([activity('buy')], 3), page([
      activity('dividend', { amount: -3.45, type: 'cash', subtype: 'dividend', iso_currency_code: 'USD' }),
      activity('other-account', { account_id: 'not-shared' }),
    ], 3));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).added, 2);
    assert.equal((await saved('buy')).amount, '-25.25');
    assert.equal((await saved('dividend')).currency, 'USD');
    assert.equal((await saved('dividend')).amount, '3.45');
    assert.equal(await saved('other-account'), undefined);
    assert.equal((await pool.query('SELECT count(*)::int n FROM transactions')).rows[0].n, 0);
    const banks = (await pool.query('SELECT provider_item_id,sync_cursor FROM bank_connections')).rows;
    assert.deepEqual(banks, [{ provider_item_id: 'investment-item', sync_cursor: 'bank-cursor' }]);
  });
  await t.test('repeated sync is idempotent, changes update in place, and shorter history does not erase records', async () => {
    const id = (await saved('buy')).id;
    const repeated = await (await sync(page([activity('buy')]))).json();
    assert.equal(repeated.added, 0); assert.equal(repeated.modified, 0); assert.equal(repeated.unchanged, 1);
    const changed = await (await sync(page([activity('buy', { amount: 30 })]))).json();
    assert.equal(changed.modified, 1); assert.equal((await saved('buy')).id, id);
    assert.equal((await saved('buy')).amount, '-30'); assert.ok(await saved('dividend'));
  });
  await t.test('null and zero amounts, missing currencies and reversal metadata survive import', async () => {
    assert.equal((await sync(page([
      activity('null', { amount: null, quantity: null, iso_currency_code: null }),
      activity('cancel', { amount: 0, type: 'cancel', cancel_transaction_id: 'buy' }),
    ]))).status, 200);
    assert.equal((await saved('null')).amount, null); assert.equal((await saved('null')).currency, null);
    assert.equal((await saved('cancel')).cancel_transaction_id, 'buy');
  });
  await t.test('partial-page and validation failures leave all saved history unchanged', async () => {
    assert.equal((await sync(page([activity('partial')], 2), new Error('Network unavailable'))).status, 502);
    assert.equal(await saved('partial'), undefined);
    assert.equal((await sync(page([activity('valid-before-error'), activity('invalid', { date: '2026-99-99' })]))).status, 502);
    assert.equal(await saved('valid-before-error'), undefined);
  });
  await t.test('consent and preparation errors preserve the Item and expose actionable states', async () => {
    assert.equal((await sync({ error_code: 'ADDITIONAL_CONSENT_REQUIRED' })).status, 409);
    assert.equal((await pool.query('SELECT investments_status FROM bank_connections')).rows[0].investments_status, 'consent_required');
    assert.equal((await sync({ error_code: 'PRODUCT_NOT_READY' })).status, 409);
    assert.equal((await pool.query('SELECT investments_status FROM bank_connections')).rows[0].investments_status, 'not_ready');
    assert.equal((await sync({ error_code: 'ITEM_LOGIN_REQUIRED' })).status, 409);
    assert.equal((await pool.query('SELECT status FROM bank_connections')).rows[0].status, 'reconnect_required');
    assert.ok(await saved('buy'));
  });
  await t.test('ownership, environment and row locks reject invalid syncs before contacting Plaid', async () => {
    const count = calls.length;
    assert.equal((await request('investments/sync', { connectionId }, other)).status, 404);
    assert.equal((await request('investments/sync', { connectionId }, owner, 'production')).status, 409);
    assert.equal((await request('investments/sync', { connectionId: 'invalid' })).status, 400);
    assert.deepEqual((await (await request('investments/transactions', undefined, other)).json()).transactions, []);
    const lock = await pool.connect();
    try {
      await lock.query('BEGIN'); await lock.query('SELECT id FROM bank_connections WHERE id=$1 FOR UPDATE', [connectionId]);
      assert.equal((await request('investments/sync', { connectionId })).status, 409);
    } finally { await lock.query('ROLLBACK'); lock.release(); }
    assert.equal(calls.length, count);
  });
  await t.test('ordinary Transactions sync cannot report investment history as still loading', async () => {
    assert.equal((await request('sync', { connectionId })).status, 409);
  });
  await t.test('investment history pagination has no duplicates and connection metadata identifies investment accounts', async () => {
    assert.equal((await sync(page(Array.from({ length: 55 }, (_, i) => activity(`history-${i}`))))).status, 200);
    const first = await (await request('investments/transactions')).json();
    assert.equal(first.transactions.length, 50); assert.ok(first.nextCursor);
    const second = await (await request(`investments/transactions?beforeDate=${first.nextCursor.date}&beforeId=${first.nextCursor.id}`)).json();
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.transactions, ...second.transactions].map(row => row.id)).size, first.transactions.length + second.transactions.length);
    const bank = (await (await request('connections')).json()).connections[0];
    assert.equal(bank.hasInvestmentAccounts, true); assert.equal(bank.hasTransactionAccounts, false);
    assert.equal(bank.investmentsStatus, 'available');
    assert.equal((await request('investments/transactions?beforeDate=bad&beforeId=bad')).status, 400);
  });
});
