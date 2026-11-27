const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const express = require('express');
const { createPlaid } = require('./plaid');
const { transactionFields } = require('./plaid-sync');
const { spendingQuery, spendingCategory, spendingEntry } = require('./budget-spending');

test('budget ranges validate actual calendar days and selected accounts', () => {
  const accountIds = randomUUID();
  assert.deepEqual(spendingQuery({ start: '2026-11-19', end: '2026-11-26', accountIds }),
    { start: '2026-11-19', end: '2026-11-26', accountIds: [accountIds] });
  for (const query of [
    { start: '2026-02-30', end: '2026-03-01', accountIds },
    { start: '2026-11-20', end: '2026-11-19', accountIds },
    { start: '2024-11-19', end: '2026-11-26', accountIds },
    { start: '2026-11-19', end: '2026-11-26', accountIds: 'not-an-account' },
    { start: '2026-11-19', end: '2026-11-26', accountIds: [accountIds] },
  ]) assert.equal(spendingQuery(query), null);
});

test('card and checking purchases consume the same budget; refunds restore it', () => {
  for (const accountType of ['credit_card', 'chequing']) {
    for (const amount of [300, -50]) {
      const fields = transactionFields({ amount, transaction_id: 'test', iso_currency_code: 'CAD',
        date: '2026-11-19', personal_finance_category: { primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES' } },
      { currency: 'CAD', account_type: accountType });
      assert.equal(fields.kind, amount > 0 ? 'expense' : 'refund');
      const entry = spendingEntry({ ...fields, spendingCents: String(-Number(fields.amount) * 100), providerCategory: fields.category });
      assert.equal(entry.amount, amount * 100);
      assert.equal(entry.name, 'Shopping');
      assert.equal(entry.subcategory, 'Clothing & shoes');
    }
  }
  assert.deepEqual(spendingCategory('FOOD_AND_DRINK_GROCERIES', 'Shopping', 'Clothing & shoes'), { name: 'Shopping', subcategory: 'Clothing & shoes' });
  assert.deepEqual(spendingCategory(null), { name: 'Other expenses', subcategory: 'Other expenses' });
  assert.throws(() => spendingEntry({ spendingCents: '9007199254740992' }));
});

test('budget spending against PostgreSQL', { skip: !process.env.BUDGET_SPENDING_TEST_DATABASE }, async t => {
  const database = process.env.BUDGET_SPENDING_TEST_DATABASE;
  assert.match(database, /^finclear_budget_test_[a-z0-9_]+$/);
  const pool = new Pool({ database });
  t.after(() => pool.end());
  const owner = randomUUID(), other = randomUUID();
  await pool.query(`INSERT INTO users(id,first_name,email,password_hash,access_role) VALUES
    ($1,'Budget owner','budget-owner@example.com',repeat('x',64),'premium'),($2,'Other owner','budget-other@example.com',repeat('x',64),'free')`, [owner, other]);
  const connections = [randomUUID(), randomUUID(), randomUUID()];
  for (const [i, id] of connections.entries()) await pool.query(`INSERT INTO bank_connections(id,user_id,institution_name,provider,provider_item_id,plaid_environment)
    VALUES($1,$2,'Test Bank','plaid',$3,$4)`, [id, i === 2 ? other : owner, `item-${i}`, i === 1 ? 'production' : 'sandbox']);
  const credit = randomUUID(), checking = randomUUID(), unselected = randomUUID(), live = randomUUID(), foreign = randomUUID(), archived = randomUUID();
  for (const [id, connection, type, user] of [[credit, connections[0], 'credit_card', owner], [checking, connections[0], 'chequing', owner],
    [unselected, connections[0], 'savings', owner], [live, connections[1], 'credit_card', owner], [foreign, connections[2], 'chequing', other], [archived, connections[0], 'chequing', owner]]) {
    await pool.query(`INSERT INTO accounts(id,user_id,connection_id,name,account_type,source,provider_account_id,currency)
      VALUES($1::uuid,$2,$3,'Test account',$4,'plaid',$1::text,'CAD')`, [id, user, connection, type]);
  }
  await pool.query('UPDATE accounts SET archived_at=now() WHERE id=$1', [archived]);
  async function add(account, amount, day, kind = 'expense', status = 'posted', provider = 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES', user = owner) {
    const id = randomUUID();
    await pool.query(`INSERT INTO transactions(id,user_id,account_id,amount,kind,status,description,booked_on,provider_category)
      VALUES($1,$2,$3,$4,$5,$6,'Test purchase',$7,$8)`, [id,user,account,amount,kind,status,day,provider]);
    return id;
  }
  const shoes = await add(credit, -500, '2026-11-19');
  await add(checking, -300, '2026-11-20');
  await add(credit, 50, '2026-11-21', 'refund');
  await add(checking, -100, '2026-11-18');
  await add(credit, -100, '2026-11-22', 'expense', 'pending');
  await add(credit, -100, '2026-11-22', 'expense', 'removed');
  await add(checking, -300, '2026-11-22', 'transfer', 'posted', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT');
  await add(credit, 300, '2026-11-22', 'transfer', 'posted', 'TRANSFER_IN_ACCOUNT_TRANSFER');
  await add(checking, 1200, '2026-11-22', 'income', 'posted', 'INCOME_WAGES');
  await add(unselected, -100, '2026-11-22');
  await add(live, -100, '2026-11-22');
  await add(foreign, -100, '2026-11-22', 'expense', 'posted', null, other);
  await add(archived, -100, '2026-11-22');
  for (let i = 0; i < 60; i++) await add(checking, -0.01, '2026-11-23');
  const app = express();
  app.use('/api/plaid', createPlaid(pool, (req, res, next) => { req.user = { id: req.get('X-Test-User') || owner }; next(); },
    { env: 'sandbox', clientId: 'test', secret: 'test', encryptionKey: 'ab'.repeat(32) }, () => { throw new Error('Read must not call Plaid'); }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (start, ids = [credit, checking], user = owner, end = '2026-11-26') => fetch(`http://127.0.0.1:${server.address().port}/api/plaid/budget-spending?${new URLSearchParams({ start, end, accountIds: ids.join(',') })}`,
    { headers: { 'X-Test-User': user, 'X-Plaid-Environment': 'sandbox' } });
  const data = async (...args) => {
    const response = await request(...args); assert.equal(response.status, 200); return response.json();
  };
  await t.test('includes the start date, every history page, purchases and refunds once', async () => {
    const result = await data('2026-11-19');
    assert.equal(result.spent, 75060);
    assert.equal(result.entries.length, 63);
    assert.equal(result.entries.find(entry => entry.id === shoes).amount, 50000);
  });
  await t.test('moving start from the 19th to the 20th removes exactly the $500 shoes purchase', async () => {
    const before = await data('2026-11-19'), after = await data('2026-11-20');
    assert.equal(before.spent - after.spent, 50000);
    assert.equal(360000 - after.spent - (360000 - before.spent), 50000);
    assert.equal(after.entries.some(entry => entry.id === shoes), false);
    assert.equal((await data('2026-11-19', [credit, checking], owner, '2026-11-20')).spent, 80000);
  });
  await t.test('selected accounts, owners, environments and archived accounts remain isolated', async () => {
    assert.equal((await data('2026-11-19', [credit])).spent, 45000);
    assert.equal((await data('2026-11-19', [checking])).spent, 30060);
    assert.equal((await data('2026-11-19', [foreign, live, archived])).spent, 0);
    assert.equal((await data('2026-11-19', [credit, checking], other)).spent, 0);
  });
  await t.test('bad dates fail and reconnecting preserves previously imported history', async () => {
    assert.equal((await request('2026-02-30')).status, 400);
    await pool.query("UPDATE bank_connections SET status='reconnect_required' WHERE id=$1", [connections[0]]);
    assert.equal((await data('2026-11-19')).spent, 75060);
  });
  await t.test('future posted records never count early and user category overrides take precedence', async () => {
    const { rows: [{ tomorrow }] } = await pool.query("SELECT to_char(CURRENT_DATE+1,'YYYY-MM-DD') AS tomorrow");
    await add(credit, -100, tomorrow);
    assert.equal((await data(tomorrow, [credit], owner, tomorrow)).spent, 0);
    const { rows: [group] } = await pool.query("INSERT INTO category_groups(user_id,name) VALUES($1,'Shopping') RETURNING id", [owner]);
    const { rows: [category] } = await pool.query("INSERT INTO categories(user_id,group_id,name) VALUES($1,$2,'Clothing & shoes') RETURNING id", [owner, group.id]);
    await pool.query("UPDATE transactions SET category_id=$1,category_overridden=true,provider_category='GENERAL_MERCHANDISE_SPORTING_GOODS' WHERE id=$2", [category.id, shoes]);
    const entry = (await data('2026-11-19')).entries.find(entry => entry.id === shoes);
    assert.equal(entry.name, 'Shopping'); assert.equal(entry.subcategory, 'Clothing & shoes');
  });
});
