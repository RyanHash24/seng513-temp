const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { Pool } = require('pg');
const { createPlaid, tokenCipher } = require('./plaid');
const { transactionFields, fetchUpdates } = require('./plaid-sync');

const owner = '10000000-0000-0000-0000-000000000002';
const other = '10000000-0000-0000-0000-000000000004';
const connectionId = '20000000-0000-0000-0000-000000000002';
const accountId = '30000000-0000-0000-0000-000000000002';
const config = { env: 'sandbox', clientId: 'test-client', secret: 'test-secret', encryptionKey: 'ab'.repeat(32) };
const transaction = (id, extra = {}) => ({ transaction_id: id, account_id: 'account-test', amount: 10,
  iso_currency_code: 'CAD', name: 'Test purchase', date: '2026-11-24', pending: false,
  personal_finance_category: { primary: 'FOOD_AND_DRINK', detailed: 'FOOD_AND_DRINK_GROCERIES' }, ...extra });
const page = extra => ({ added: [], modified: [], removed: [], next_cursor: 'cursor-final', has_more: false,
  transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE', ...extra });

test('transaction mapping preserves bank signs, transfers, pending state, zero authorizations and currencies', () => {
  const account = { currency: 'CAD' };
  assert.equal(transactionFields(transaction('expense'), account).amount, '-10.00');
  assert.equal(transactionFields(transaction('income', { amount: -100, personal_finance_category: { primary: 'INCOME' } }), account).kind, 'income');
  assert.equal(transactionFields(transaction('refund', { amount: -10 }), account).kind, 'refund');
  assert.equal(transactionFields(transaction('transfer', { personal_finance_category: { primary: 'TRANSFER_IN' } }), account).kind, 'transfer');
  assert.equal(transactionFields(transaction('pending', { pending: true }), account).status, 'pending');
  assert.equal(transactionFields(transaction('zero', { amount: 0 }), account).amount, '0.00');
  assert.throws(() => transactionFields(transaction('bad', { amount: NaN }), account));
  assert.throws(() => transactionFields(transaction('bad', { iso_currency_code: 'USD' }), account));
});

test('pagination mutation discards the partial batch and restarts from the original cursor', async () => {
  const cursors = [];
  const responses = [page({ added: [transaction('discard')], has_more: true, next_cursor: 'partial' }),
    Object.assign(new Error('mutation'), { plaidCode: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' }),
    page({ added: [transaction('keep')] })];
  const result = await fetchUpdates(async (path, body) => {
    assert.equal(path, '/transactions/sync'); cursors.push(body.cursor);
    const response = responses.shift(); if (response instanceof Error) throw response; return response;
  }, { accessToken: 'test-token', sync_cursor: 'original' });
  assert.deepEqual(cursors, ['original', 'partial', 'original']);
  assert.deepEqual(result.added.map(item => item.transaction_id), ['keep']);
});

test('pagination retries are bounded and malformed or nonadvancing pages fail', async () => {
  let attempts = 0;
  await assert.rejects(() => fetchUpdates(async () => {
    attempts++; throw Object.assign(new Error('mutation'), { plaidCode: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' });
  }, {}));
  assert.equal(attempts, 3);
  await assert.rejects(() => fetchUpdates(async () => ({}), {}));
  await assert.rejects(() => fetchUpdates(async () => page({ has_more: true, next_cursor: '' }), {}));
});

test('transaction sync against PostgreSQL', { skip: !process.env.PLAID_SYNC_TEST_DATABASE }, async t => {
  const database = process.env.PLAID_SYNC_TEST_DATABASE;
  assert.match(database, /^finclear_sync_test_[a-z0-9_]+$/);
  const pool = new Pool({ database });
  t.after(() => pool.end());
  await pool.query(`INSERT INTO users (id,first_name,email,password_hash,access_role) VALUES
    ($1,'Morgan','morgan@example.com',repeat('x',64),'premium'),($2,'Alex','alex@example.com',repeat('x',64),'free')`, [owner, other]);
  await pool.query(`INSERT INTO bank_connections (id,user_id,institution_name,provider,provider_item_id,provider_institution_id)
    VALUES ($1,$2,'Test Bank','plaid','item-test','test-bank')`, [connectionId, owner]);
  await pool.query('INSERT INTO plaid_item_secrets (connection_id,encrypted_token) VALUES ($1,$2)',
    [connectionId, tokenCipher(config.encryptionKey).encrypt('access-sandbox-test', `${owner}:${connectionId}`)]);
  await pool.query(`INSERT INTO accounts (id,user_id,connection_id,name,account_type,source,provider_account_id,currency)
    VALUES ($1,$2,$3,'Test chequing','chequing','plaid','account-test','CAD')`, [accountId, owner, connectionId]);
  const { rows: [group] } = await pool.query("INSERT INTO category_groups(user_id,name) VALUES($1,'Personal') RETURNING id", [owner]);
  const { rows: [category] } = await pool.query("INSERT INTO categories(user_id,group_id,name) VALUES($1,$2,'My category') RETURNING id", [owner, group.id]);
  const calls = []; let responses = [];
  const api = async (url, init) => {
    assert.equal(url, 'https://sandbox.plaid.com/transactions/sync');
    const body = JSON.parse(init.body); calls.push(body);
    assert.equal(body.access_token, 'access-sandbox-test');
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'Unexpected additional provider request');
    if (response.error_code) return { ok: false, json: async () => response };
    return { ok: true, json: async () => response };
  };
  const app = express(); app.use(express.json());
  app.use('/api/plaid', createPlaid(pool, (req, res, next) => { req.user = { id: req.get('X-Test-User') || owner }; next(); }, config, api));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (path, body, user = owner) => fetch(`http://127.0.0.1:${server.address().port}/api/plaid/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json',
      'X-Test-User': user, 'X-Plaid-Environment': 'sandbox' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  async function sync(...pages) { responses = pages; return request('sync', { connectionId }); }
  const saved = async id => (await pool.query('SELECT * FROM transactions WHERE provider_transaction_id=$1', [id])).rows[0];
  const cursor = async () => (await pool.query('SELECT sync_cursor FROM bank_connections WHERE id=$1', [connectionId])).rows[0].sync_cursor;

  await t.test('initial multi-page history imports only saved accounts and permits bank zero authorizations', async () => {
    const response = await sync(page({ added: [transaction('purchase'), transaction('zero', { amount: 0 })], next_cursor: 'page-one', has_more: true }),
      page({ added: [transaction('salary', { amount: -1200, personal_finance_category: { primary: 'INCOME' } }), transaction('unshared', { account_id: 'unshared-account' })] }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { added: 3, modified: 0, removed: 0, skipped: 1, updateStatus: 'HISTORICAL_UPDATE_COMPLETE' });
    assert.deepEqual(calls.slice(-2).map(call => call.cursor), ['', 'page-one']);
    assert.equal((await saved('purchase')).amount, '-10.00');
    assert.equal((await saved('salary')).amount, '1200.00');
    assert.equal((await saved('zero')).amount, '0.00');
    assert.equal(await saved('unshared'), undefined);
    assert.equal(await cursor(), 'cursor-final');
    await assert.rejects(() => pool.query(`INSERT INTO transactions(user_id,account_id,amount,kind,description,booked_on)
      VALUES ($1,$2,0,'expense','Manual zero',CURRENT_DATE)`, [owner, accountId]), { code: '23514' });
  });

  await t.test('repeat syncs use the saved cursor without duplicating transactions', async () => {
    const originalId = (await saved('purchase')).id;
    assert.equal((await sync(page())).status, 200);
    assert.equal(calls.at(-1).cursor, 'cursor-final');
    assert.equal((await saved('purchase')).id, originalId);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM transactions')).rows[0].count, 3);
  });

  await t.test('modified transactions retain user category overrides and notes', async () => {
    await pool.query(`UPDATE transactions SET category_id=$1,category_overridden=true,notes='Keep my note' WHERE provider_transaction_id='purchase'`, [category.id]);
    const originalId = (await saved('purchase')).id;
    assert.equal((await sync(page({ modified: [transaction('purchase', { amount: 24.99, name: 'Changed merchant' })] }))).status, 200);
    const row = await saved('purchase');
    assert.equal(row.id, originalId); assert.equal(row.amount, '-24.99');
    assert.equal(row.category_id, category.id); assert.equal(row.category_overridden, true); assert.equal(row.notes, 'Keep my note');
  });

  await t.test('pending-to-posted replacements preserve edits and remove the old pending entry', async () => {
    assert.equal((await sync(page({ added: [transaction('pending', { pending: true })] }))).status, 200);
    await pool.query(`UPDATE transactions SET category_id=$1,category_overridden=true,notes='Pending note' WHERE provider_transaction_id='pending'`, [category.id]);
    assert.equal((await sync(page({ added: [transaction('posted', { amount: 12, pending_transaction_id: 'pending' })],
      removed: [{ transaction_id: 'pending', account_id: 'account-test' }] }))).status, 200);
    assert.equal((await saved('pending')).status, 'removed');
    const posted = await saved('posted');
    assert.equal(posted.status, 'posted'); assert.equal(posted.amount, '-12.00');
    assert.equal(posted.category_id, category.id); assert.equal(posted.notes, 'Pending note');
  });

  await t.test('removed transactions stay stored but disappear from the displayed history', async () => {
    const response = await sync(page({ removed: [{ transaction_id: 'purchase', account_id: 'account-test' }] }));
    assert.equal((await response.json()).removed, 1);
    assert.equal((await saved('purchase')).status, 'removed');
    const history = await (await request('transactions')).json();
    assert.equal(history.transactions.some(row => row.description === 'Changed merchant'), false);
    assert.equal(history.transactions.some(row => row.category === 'My category'), true);
  });

  await t.test('an invalid later record rolls back earlier writes and leaves the cursor unchanged', async () => {
    const previous = await cursor();
    const response = await sync(page({ added: [transaction('rollback-first'), transaction('rollback-bad', { date: '2026-02-31' })], next_cursor: 'must-not-save' }));
    assert.equal(response.status, 502);
    assert.equal(await saved('rollback-first'), undefined); assert.equal(await saved('rollback-bad'), undefined);
    assert.equal(await cursor(), previous);
  });

  await t.test('provider pagination errors roll back without advancing the cursor', async () => {
    const previous = await cursor();
    const response = await sync(page({ added: [transaction('not-saved')], next_cursor: 'partial', has_more: true }), new Error('Network unavailable'));
    assert.equal(response.status, 502); assert.equal(await saved('not-saved'), undefined); assert.equal(await cursor(), previous);
  });

  await t.test('another user cannot sync or read this connection and invalid input never calls Plaid', async () => {
    const count = calls.length;
    assert.equal((await request('sync', { connectionId }, other)).status, 404);
    assert.equal((await request('sync', { connectionId: 'invalid' })).status, 400);
    assert.deepEqual((await (await request('transactions', undefined, other)).json()).transactions, []);
    assert.equal(calls.length, count);
  });

  await t.test('concurrent sync requests cannot advance the same connection twice', async () => {
    const lock = await pool.connect();
    try {
      await lock.query('BEGIN'); await lock.query('SELECT id FROM bank_connections WHERE id=$1 FOR UPDATE', [connectionId]);
      const count = calls.length;
      assert.equal((await request('sync', { connectionId })).status, 409);
      assert.equal(calls.length, count);
    } finally { await lock.query('ROLLBACK'); lock.release(); }
  });

  await t.test('login-required errors retain history and cursor and request reconnection', async () => {
    const previous = await cursor();
    assert.equal((await sync({ error_code: 'ITEM_LOGIN_REQUIRED' })).status, 409);
    assert.equal(await cursor(), previous);
    assert.equal((await pool.query('SELECT status FROM bank_connections WHERE id=$1', [connectionId])).rows[0].status, 'reconnect_required');
  });

  await t.test('history pages use stable date and id ordering without duplicates', async () => {
    assert.equal((await sync(page({ added: Array.from({ length: 55 }, (_, index) => transaction(`history-${index}`)) }))).status, 200);
    const first = await (await request('transactions')).json();
    assert.equal(first.transactions.length, 50); assert.ok(first.nextCursor);
    const second = await (await request(`transactions?beforeDate=${first.nextCursor.date}&beforeId=${first.nextCursor.id}`)).json();
    assert.equal(second.nextCursor, null);
    assert.equal(new Set([...first.transactions, ...second.transactions].map(row => row.id)).size, first.transactions.length + second.transactions.length);
    assert.equal((await request('transactions?beforeDate=bad&beforeId=bad')).status, 400);
  });

  await t.test('not-ready history is reported without inventing transactions or new bank connections', async () => {
    const response = await sync(page({ transactions_update_status: 'NOT_READY', next_cursor: '' }));
    assert.equal((await response.json()).updateStatus, 'NOT_READY');
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM bank_connections')).rows[0].count, 1);
    assert.equal(responses.length, 0);
  });
});
