const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { Pool } = require('pg');
const { createPlaid, tokenCipher } = require('./plaid');

const owner = '11000000-0000-0000-0000-000000000001';
const other = '11000000-0000-0000-0000-000000000002';
const connectionIds = { sandbox: '21000000-0000-0000-0000-000000000001', production: '21000000-0000-0000-0000-000000000002' };
const accountIds = { sandbox: '31000000-0000-0000-0000-000000000001', production: '31000000-0000-0000-0000-000000000002' };
const sessionIds = { sandbox: '41000000-0000-0000-0000-000000000001', production: '41000000-0000-0000-0000-000000000002' };
const encryptionKey = 'cd'.repeat(32);
const cipher = tokenCipher(encryptionKey);
const context = (user, id, environment) => `${user}:${id}${environment === 'production' ? ':production' : ''}`;

test('Sandbox and Production stay isolated in PostgreSQL and HTTP routes', { skip: !process.env.PLAID_ENVIRONMENT_TEST_DATABASE }, async t => {
  const database = process.env.PLAID_ENVIRONMENT_TEST_DATABASE;
  assert.match(database, /^finclear_env_test_[a-z0-9_]+$/);
  const pool = new Pool({ database });
  t.after(() => pool.end());
  await pool.query(`INSERT INTO users(id,first_name,email,password_hash,access_role,email_verified_at) VALUES
    ($1,'Morgan','env-morgan@example.com',repeat('x',64),'premium',now()),($2,'Alex','env-alex@example.com',repeat('x',64),'free',now())`, [owner, other]);
  const calls = [], items = new Map();
  for (const environment of ['sandbox', 'production']) {
    const connection = connectionIds[environment], account = accountIds[environment];
    const accessToken = `access-${environment}-saved`;
    await pool.query(`INSERT INTO bank_connections(id,user_id,institution_name,provider,provider_item_id,provider_institution_id,plaid_environment,sync_cursor,access_token_secret_ref)
      VALUES($1,$2,'Same bank','plaid','same-provider-item-id','bank-shared',$3,$4,$5)`,
      [connection, owner, environment, `${environment}-original-cursor`, `plaid-item:${connection}`]);
    await pool.query('INSERT INTO plaid_item_secrets(connection_id,encrypted_token) VALUES($1,$2)',
      [connection, cipher.encrypt(accessToken, context(owner, connection, environment))]);
    await pool.query(`INSERT INTO accounts(id,user_id,connection_id,name,account_type,source,provider_account_id,currency)
      VALUES($1,$2,$3,$4,'chequing','plaid','same-provider-account-id','CAD')`, [account, owner, connection, `${environment} account`]);
    await pool.query(`INSERT INTO transactions(user_id,account_id,provider_transaction_id,amount,currency,kind,description,booked_on,provider_synced_at)
      VALUES($1,$2,'same-provider-transaction-id',-10,'CAD','expense',$3,'2026-11-24',now())`, [owner, account, `${environment} purchase`]);
    await pool.query(`INSERT INTO plaid_link_sessions(id,user_id,mode,connection_id,encrypted_link_token,expires_at,completed_at,plaid_environment)
      VALUES($1,$2,'new',$3,$4,now()+interval '1 hour',now(),$5)`,
      [sessionIds[environment], owner, connection,
        cipher.encrypt(`link-${environment}-saved`, context(owner, `link:${sessionIds[environment]}`, environment)), environment]);
    items.set(accessToken, { item_id: 'same-provider-item-id', institution_id: 'bank-shared', account_id: 'same-provider-account-id' });
  }

  let institution = 'bank-new', failAccounts = false, exchanges = 0;
  const servers = {};
  for (const environment of ['sandbox', 'production']) {
    const mockPlaid = async (url, init) => {
      assert.ok(url.startsWith(`https://${environment}.plaid.com/`));
      const path = new URL(url).pathname, body = JSON.parse(init.body);
      assert.equal(body.secret, `${environment}-fake-secret`);
      for (const field of ['access_token', 'link_token', 'public_token']) {
        if (body[field]) assert.ok(body[field].startsWith(`${field.split('_')[0]}-${environment}-`));
      }
      calls.push({ environment, path, body });
      let data;
      if (path === '/link/token/create') data = { link_token: `link-${environment}-new`, expiration: new Date(Date.now()+3600000).toISOString() };
      else if (path === '/link/token/get') data = { link_sessions: [{ results: { item_add_results: [{
        public_token: `public-${environment}-new`, institution: { institution_id: institution, name: 'New bank' }, accounts: [{ id: 'new-provider-account' }],
      }] } }] };
      else if (path === '/item/public_token/exchange') {
        exchanges++;
        const accessToken = `access-${environment}-new`, itemId = `new-${environment}-item`;
        items.set(accessToken, { item_id: itemId, institution_id: institution, account_id: 'new-provider-account' });
        data = { access_token: accessToken, item_id: itemId };
      } else if (path === '/accounts/get') {
        if (failAccounts) { failAccounts = false; return { ok: false, json: async () => ({ error_code: 'INSTITUTION_DOWN' }) }; }
        const item = items.get(body.access_token);
        data = { item, accounts: [{ account_id: item.account_id, name: `${environment} new account`, type: 'depository', subtype: 'checking',
          mask: '1234', balances: { iso_currency_code: 'CAD', current: 100, available: 90 } }] };
      } else if (path === '/item/get') data = { item: { ...items.get(body.access_token), error: null } };
      else if (path === '/transactions/sync') data = { added: [{ transaction_id: 'new-synced-transaction',
        account_id: items.get(body.access_token).account_id, amount: 12.34, iso_currency_code: 'CAD',
        name: `${environment} synced purchase`, date: '2026-11-24', pending: false }],
        modified: [], removed: [], next_cursor: `${environment}-updated-cursor`, has_more: false,
        transactions_update_status: 'HISTORICAL_UPDATE_COMPLETE' };
      else throw new Error(`Unexpected mock endpoint ${path}`);
      return { ok: true, json: async () => data };
    };
    const app = express(); app.use(express.json());
    app.use('/api/plaid', createPlaid(pool, (req, res, next) => { req.user = { id: req.get('X-Test-User') || owner }; next(); }, {
      env: environment, clientId: 'fake-client', sandboxSecret: 'sandbox-fake-secret', productionSecret: 'production-fake-secret',
      productionEnabled: true, encryptionKey,
    }, mockPlaid));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    servers[environment] = server;
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  }
  const request = (environment, path, body, headers = {}) => fetch(`http://127.0.0.1:${servers[environment].address().port}/api/plaid/${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json',
      'X-Plaid-Environment': environment, ...headers }, body: body === undefined ? undefined : JSON.stringify(body),
  });

  await t.test('the same bank and provider identifiers coexist across environments', async () => {
    const { rows } = await pool.query("SELECT plaid_environment FROM bank_connections WHERE provider_institution_id='bank-shared' ORDER BY plaid_environment");
    assert.deepEqual(rows.map(row => row.plaid_environment), ['production', 'sandbox']);
    await assert.rejects(() => pool.query(`INSERT INTO bank_connections(user_id,institution_name,provider,provider_item_id,provider_institution_id,plaid_environment)
      VALUES($1,'Duplicate bank','plaid','another-item','bank-shared','sandbox')`, [owner]), { code: '23505' });
  });

  await t.test('connection, account, and transaction reads return only the active environment', async () => {
    for (const environment of ['sandbox', 'production']) {
      const bank = await (await request(environment, 'connections')).json();
      const accounts = await (await request(environment, 'accounts')).json();
      const history = await (await request(environment, 'transactions')).json();
      assert.deepEqual(bank.connections.map(row => row.id), [connectionIds[environment]]);
      assert.deepEqual(accounts.accounts.map(row => row.id), [accountIds[environment]]);
      assert.equal(accounts.accounts[0].accountType, 'chequing');
      assert.equal(accounts.accounts[0].connectionId, connectionIds[environment]);
      assert.equal(accounts.accounts[0].connectionStatus, 'connected');
      assert.equal(accounts.accounts[0].encrypted_token, undefined);
      assert.deepEqual(history.transactions.map(row => row.description), [`${environment} purchase`]);
    }
    assert.equal(calls.length, 0);
  });

  await t.test('account history filters before pagination and stays isolated by owner and environment', async () => {
    const secondary = '31000000-0000-0000-0000-000000000003';
    await pool.query(`INSERT INTO accounts(id,user_id,connection_id,name,account_type,source,provider_account_id,currency)
      VALUES($1,$2,$3,'Second account','investment','plaid','second-provider-account','CAD')`, [secondary, owner, connectionIds.sandbox]);
    await pool.query(`INSERT INTO transactions(user_id,account_id,provider_transaction_id,amount,currency,kind,description,booked_on,provider_synced_at)
      SELECT $1,$2,'page-'||n,-1,'CAD','expense','Second account purchase '||n,'2026-11-25',now()
      FROM generate_series(1,52) n`, [owner, secondary]);
    await pool.query(`INSERT INTO investment_transactions(user_id,account_id,provider_transaction_id,booked_on,description,activity_type,amount,currency)
      VALUES($1,$2,'first-investment','2026-11-24','First account dividend','cash',10,'CAD'),
      ($1,$3,'second-investment','2026-11-25','Second account dividend','cash',20,'CAD')`, [owner, accountIds.sandbox, secondary]);
    try {
      const first = await (await request('sandbox', 'transactions?accountId='+accountIds.sandbox)).json();
      assert.equal(first.transactions.length, 1);
      assert.equal(first.transactions[0].accountId, accountIds.sandbox);
      assert.equal(first.nextCursor, null);
      const page = await (await request('sandbox', 'transactions?accountId='+secondary)).json();
      assert.equal(page.transactions.length, 50);
      assert.ok(page.transactions.every(row => row.accountId === secondary));
      const nextQuery = new URLSearchParams({ accountId: secondary, beforeDate: page.nextCursor.date, beforeId: page.nextCursor.id });
      const next = await (await request('sandbox', 'transactions?'+nextQuery)).json();
      assert.equal(next.transactions.length, 2);
      assert.equal(new Set([...page.transactions, ...next.transactions].map(row => row.id)).size, 52);
      assert.equal(next.nextCursor, null);
      for (const path of ['transactions','investments/transactions']) {
        assert.deepEqual((await (await request('production', path+'?accountId='+secondary)).json()).transactions, []);
        assert.deepEqual((await (await request('sandbox', path+'?accountId='+secondary, undefined, { 'X-Test-User': other })).json()).transactions, []);
        assert.equal((await request('sandbox', path+'?accountId=invalid')).status, 400);
        assert.equal((await request('sandbox', path+'?accountId='+secondary+'&accountId='+secondary)).status, 400);
      }
      const activity = await (await request('sandbox', 'investments/transactions?accountId='+secondary)).json();
      assert.deepEqual(activity.transactions.map(row => row.description), ['Second account dividend']);
      assert.equal(activity.transactions[0].accountId, secondary);
    } finally {
      await pool.query('DELETE FROM investment_transactions WHERE user_id=$1', [owner]);
      await pool.query('DELETE FROM transactions WHERE account_id=$1', [secondary]);
      await pool.query('DELETE FROM accounts WHERE id=$1', [secondary]);
    }
    assert.equal(calls.length, 0);
  });

  await t.test('reconnecting accounts remain visible while archived and disconnected accounts are excluded', async () => {
    try {
      await pool.query("UPDATE bank_connections SET status='reconnect_required' WHERE id=$1", [connectionIds.sandbox]);
      const reconnecting = await (await request('sandbox', 'accounts')).json();
      assert.deepEqual(reconnecting.accounts.map(row => row.id), [accountIds.sandbox]);
      assert.equal(reconnecting.accounts[0].connectionStatus, 'reconnect_required');
      await pool.query('UPDATE accounts SET archived_at=now() WHERE id=$1', [accountIds.sandbox]);
      assert.deepEqual((await (await request('sandbox', 'accounts')).json()).accounts, []);
      await pool.query('UPDATE accounts SET archived_at=NULL WHERE id=$1', [accountIds.sandbox]);
      await pool.query("UPDATE bank_connections SET status='disconnected' WHERE id=$1", [connectionIds.sandbox]);
      assert.deepEqual((await (await request('sandbox', 'accounts')).json()).accounts, []);
    } finally {
      await pool.query("UPDATE bank_connections SET status='connected' WHERE id=$1", [connectionIds.sandbox]);
      await pool.query('UPDATE accounts SET archived_at=NULL WHERE id=$1', [accountIds.sandbox]);
    }
    assert.equal(calls.length, 0);
  });

  await t.test('stale browser headers cannot read or mutate the other environment', async () => {
    const count = calls.length;
    for (const environment of ['sandbox', 'production']) {
      const opposite = environment === 'sandbox' ? 'production' : 'sandbox';
      assert.equal((await request(environment, 'transactions', undefined, { 'X-Plaid-Environment': opposite })).status, 409);
      assert.equal((await request(environment, 'link-token', {}, { 'X-Plaid-Environment': opposite })).status, 409);
    }
    assert.equal(calls.length, count);
  });

  await t.test('cross-environment reconnects, syncs and completed sessions make no provider calls', async () => {
    const count = calls.length;
    for (const environment of ['sandbox', 'production']) {
      const opposite = environment === 'sandbox' ? 'production' : 'sandbox';
      assert.equal((await request(environment, 'link-token', { connectionId: connectionIds[opposite] })).status, 404);
      assert.equal((await request(environment, 'sync', { connectionId: connectionIds[opposite] })).status, 404);
      assert.equal((await request(environment, 'exchange', { sessionId: sessionIds[opposite], publicToken: `public-${environment}-new`, accountIds: ['new-provider-account'] })).status, 404);
      assert.equal((await request(environment, 'exchange', { sessionId: sessionIds[environment], publicToken: `public-${environment}-new`, accountIds: ['new-provider-account'] })).status, 200);
    }
    assert.equal(calls.length, count);
  });

  await t.test('session foreign keys reject mismatched owners and environments', async () => {
    for (const [userId, environment] of [[owner, 'production'], [other, 'sandbox']]) {
      await assert.rejects(() => pool.query(`INSERT INTO plaid_link_sessions(user_id,mode,connection_id,encrypted_link_token,expires_at,plaid_environment)
        VALUES($1,'update',$2,'unused',now()+interval '1 hour',$3)`, [userId, connectionIds.sandbox, environment]), { code: '23503' });
    }
  });

  await t.test('sync updates only the active ledger and its own cursor', async () => {
    assert.equal((await request('production', 'sync', { connectionId: connectionIds.production })).status, 200);
    let { rows } = await pool.query('SELECT plaid_environment,sync_cursor FROM bank_connections ORDER BY plaid_environment');
    assert.equal(rows.find(row => row.plaid_environment === 'sandbox').sync_cursor, 'sandbox-original-cursor');
    assert.equal(rows.find(row => row.plaid_environment === 'production').sync_cursor, 'production-updated-cursor');
    const sandbox = await (await request('sandbox', 'transactions')).json();
    const production = await (await request('production', 'transactions')).json();
    assert.equal(sandbox.transactions.length, 1); assert.equal(production.transactions.length, 2);
    assert.equal(production.transactions.every(row => row.description.startsWith('production ')), true);
    assert.equal((await request('sandbox', 'sync', { connectionId: connectionIds.sandbox })).status, 200);
  });

  await t.test('a failed live account save retains the Item and retries without exchanging another token', async () => {
    institution = 'bank-new';
    const { sessionId } = await (await request('production', 'link-token', {})).json();
    const body = { sessionId, publicToken: 'public-production-new', accountIds: ['new-provider-account'] };
    failAccounts = true;
    assert.equal((await request('production', 'exchange', body)).status, 502);
    const { rows: [pending] } = await pool.query("SELECT id,status FROM bank_connections WHERE provider_institution_id='bank-new' AND plaid_environment='production'");
    assert.ok(pending); assert.equal(pending.status, 'pending'); assert.equal(exchanges, 1);
    const count = calls.length;
    assert.equal((await request('production', 'sync', { connectionId: pending.id })).status, 409);
    assert.equal(calls.length, count);
    const retry = await request('production', 'exchange', body);
    assert.equal(retry.status, 201); assert.equal((await retry.json()).connectionId, pending.id);
    assert.equal(exchanges, 1);
    assert.equal((await pool.query('SELECT status FROM bank_connections WHERE id=$1', [pending.id])).rows[0].status, 'connected');
    assert.equal((await request('production', 'exchange', body)).status, 200);
    assert.equal(exchanges, 1);
    assert.equal(calls.some(call => call.path === '/item/remove'), false);
  });

  await t.test('another user cannot access either environment or its saved connections', async () => {
    for (const environment of ['sandbox', 'production']) {
      const headers = { 'X-Test-User': other };
      for (const path of ['accounts', 'connections', 'transactions']) {
        const result = await (await request(environment, path, undefined, headers)).json();
        assert.deepEqual(result[path], []);
      }
      assert.equal((await request(environment, 'sync', { connectionId: connectionIds[environment] }, headers)).status, 404);
    }
  });
});
