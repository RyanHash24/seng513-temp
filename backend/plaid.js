const express = require('express');
const { randomBytes, randomUUID, createCipheriv, createDecipheriv } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');
const { syncTransactions } = require('./plaid-sync');
const { syncInvestments } = require('./plaid-investments');
const { spendingQuery, readBudgetSpending } = require('./budget-spending');
const { checkQuota } = require('./entitlements');

function tokenCipher(hexKey) {
  if (!/^[a-f0-9]{64}$/i.test(hexKey || '')) throw new Error('PLAID_TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters.');
  const key = Buffer.from(hexKey, 'hex');
  return {
    encrypt(token, owner) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(owner));
      const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
    },
    decrypt(value, owner) {
      const packed = Buffer.from(value, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
      decipher.setAAD(Buffer.from(owner));
      decipher.setAuthTag(packed.subarray(12, 28));
      return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}

function accountType(account) {
  if (account.type === 'depository') return ({ checking: 'chequing', savings: 'savings', cd: 'savings',
    'money market': 'savings', 'cash management': 'cash', hsa: 'savings' })[account.subtype] || 'other';
  return ({ credit: 'credit_card', loan: 'loan', investment: 'investment' })[account.type] || 'other';
}

function createPlaid(pool, requireAuth, config = {}, fetchImpl = fetch) {
  const router = express.Router();
  const environment = config.env === undefined ? 'sandbox' : config.env;
  const host = environment === 'sandbox' ? 'https://sandbox.plaid.com'
    : environment === 'production' ? 'https://production.plaid.com' : null;
  const secret = environment === 'sandbox' ? config.sandboxSecret || config.secret : config.productionSecret;
  const enabled = environment === 'sandbox' || (environment === 'production' && config.productionEnabled === true);
  const origins = config.origins || ['http://localhost:5173', 'http://127.0.0.1:5173'];
  let cipher;
  if (config.encryptionKey) cipher = tokenCipher(config.encryptionKey);
  const configured = Boolean(host && enabled && config.clientId && secret && cipher);
  // retain the existing sandbox encryption context
  // live tokens use a distinct context
  const tokenOwner = (userId, id) => `${userId}:${id}${environment === 'production' ? ':production' : ''}`;
  function checkToken(token, type) {
    if (typeof token !== 'string' || !token.startsWith(`${type}-${environment}-`)) throw new Error('Unexpected token environment');
    return token;
  }
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (host) res.set('X-Plaid-Environment', environment);
    next();
  });
  router.use(requireAuth);
  router.get('/status', (req, res) => res.json({ environment: host ? environment : null, configured }));
  router.use((req, res, next) => {
    if (req.method !== 'GET' && (!origins.includes(req.get('Origin')) || !req.is('application/json'))) {
      return res.status(403).json({ error: 'Request origin or content type is not allowed.' });
    }
    if (!configured) {
      return res.status(503).json({ error: environment === 'production' && !enabled
        ? 'Live bank connections are disabled on the backend.' : 'Plaid is not configured for the selected environment.' });
    }
    if (req.get('X-Plaid-Environment') !== environment) {
      return res.status(409).json({ error: 'The bank environment changed. Reload this page before continuing.' });
    }
    next();
  });
  router.use(rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many bank requests. Please try again shortly.' } }));
  async function request(path, body) {
    for (const [field, type] of [['access_token', 'access'], ['public_token', 'public'], ['link_token', 'link']]) {
      if (body[field] !== undefined) checkToken(body[field], type);
    }
    const response = await fetchImpl(`${host}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Plaid-Version': '2020-09-14' },
      body: JSON.stringify({ ...body, client_id: config.clientId, secret }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json();
    if (!response.ok) { const error = new Error('Plaid request failed'); error.plaidCode = data.error_code; throw error; }
    return data;
  }

  const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
  function problem(status, message, connectionId) {
    return Object.assign(new Error(message), { status, connectionId });
  }
  function sendError(res, error, fallback) {
    return res.status(error.status || 502).json({ error: error.status ? error.message : fallback,
      ...(error.connectionId ? { connectionId: error.connectionId } : {}) });
  }
  async function savedConnection(userId, id, client = pool, lock = false) {
    const { rows: [row] } = await client.query(`SELECT b.id, b.user_id, b.provider_item_id, b.institution_name,
      b.provider_institution_id, b.sync_cursor, b.plaid_environment, b.status, s.encrypted_token FROM bank_connections b
      JOIN plaid_item_secrets s ON s.connection_id=b.id
      WHERE b.id=$1 AND b.user_id=$2 AND b.provider='plaid' AND b.plaid_environment=$3${lock ? ' FOR UPDATE OF b NOWAIT' : ''}`, [id, userId, environment]);
    if (!row) throw problem(404, 'Bank connection not found.');
    const accessToken = checkToken(cipher.decrypt(row.encrypted_token, tokenOwner(userId, id)), 'access');
    return { ...row, accessToken };
  }
  async function readItem(connection) {
    const { item } = await request('/item/get', { access_token: connection.accessToken });
    if (item?.item_id !== connection.provider_item_id || !item.institution_id) throw new Error('Item mismatch');
    return item;
  }
  async function session(client, userId, sessionId, mode) {
    if (!uuid(sessionId)) throw problem(400, 'A valid bank-linking session is required.');
    const { rows: [row] } = await client.query(`SELECT * FROM plaid_link_sessions
      WHERE id=$1 AND user_id=$2 AND mode=$3 AND plaid_environment=$4 FOR UPDATE`, [sessionId, userId, mode, environment]);
    if (!row) throw problem(404, 'Bank-linking session not found.');
    if (!row.completed_at && new Date(row.expires_at) <= new Date()) throw problem(410, 'Bank-linking session expired. Please start again.');
    return row;
  }
  async function saveAccounts(client, userId, connectionId, accounts) {
    if (!Array.isArray(accounts) || !accounts.length) throw new Error('No shared accounts');
    for (const account of accounts) {
      const currency = account.balances?.iso_currency_code;
      if (!/^[A-Z]{3}$/.test(currency || '')) throw new Error('Unsupported account currency');
      const { rows } = await client.query(`INSERT INTO accounts
        (user_id, connection_id, name, account_type, source, provider_account_id, mask, currency, current_balance, available_balance, balance_updated_at)
        VALUES ($1,$2,$3,$4,'plaid',$5,$6,$7,$8,$9,now())
        ON CONFLICT (connection_id, provider_account_id) DO UPDATE SET
          name=EXCLUDED.name, account_type=EXCLUDED.account_type, mask=EXCLUDED.mask,
          current_balance=EXCLUDED.current_balance, available_balance=EXCLUDED.available_balance,
          balance_updated_at=now(), archived_at=NULL
        WHERE accounts.user_id=EXCLUDED.user_id AND accounts.currency=EXCLUDED.currency RETURNING id`,
        [userId, connectionId, account.name, accountType(account), account.account_id,
          /^[0-9]{4}$/.test(account.mask || '') ? account.mask : null, currency, account.balances.current, account.balances.available]);
      if (!rows.length) throw new Error('Account ownership or currency mismatch');
    }
    await client.query(`UPDATE accounts SET archived_at=now() WHERE connection_id=$1 AND user_id=$2
      AND source='plaid' AND NOT (provider_account_id=ANY($3::text[]))`, [connectionId, userId, accounts.map(account => account.account_id)]);
  }

  router.post('/link-token', async (req, res) => {
    try {
      const connectionId = req.body?.connectionId;
      const product = req.body?.product;
      if (product !== undefined && !['transactions', 'investments'].includes(product)) throw problem(400, 'Choose bank transactions or investment activity.');
      if (connectionId !== undefined && !uuid(connectionId)) throw problem(400, 'A valid bank connection is required.');
      const linkRequest = { user: { client_user_id: req.user.id }, client_name: 'FinClear',
        country_codes: ['CA', 'US'], language: 'en' };
      if (connectionId) {
        const connection = await savedConnection(req.user.id, connectionId);
        const item = await readItem(connection);
        await pool.query('UPDATE bank_connections SET provider_institution_id=$1 WHERE id=$2 AND user_id=$3 AND plaid_environment=$4',
          [item.institution_id, connectionId, req.user.id, environment]);
        linkRequest.access_token = connection.accessToken;
        if (product === 'investments') {
          const { institution } = await request('/institutions/get_by_id', { institution_id: item.institution_id, country_codes: ['CA', 'US'] });
          if (!institution?.products?.includes('investments')) {
            throw problem(409, 'This institution does not support investment activity through Plaid. Your existing bank connection is unchanged.');
          }
          linkRequest.additional_consented_products = ['investments'];
        }
      } else linkRequest.products = [product || 'transactions'];
      const data = await request('/link/token/create', linkRequest);
      checkToken(data.link_token, 'link');
      const id = randomUUID();
      await pool.query(`INSERT INTO plaid_link_sessions
        (id,user_id,mode,connection_id,encrypted_link_token,expires_at,plaid_environment,requested_product) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, req.user.id, connectionId ? 'update' : 'new', connectionId || null,
          cipher.encrypt(data.link_token, tokenOwner(req.user.id, `link:${id}`)), data.expiration, environment,
          connectionId ? product || null : product || 'transactions']);
      return res.json({ linkToken: data.link_token, sessionId: id });
    } catch (error) { return sendError(res, error, 'Unable to start bank linking. Please try again.'); }
  });

  router.post('/exchange', async (req, res) => {
    const { publicToken, accountIds, sessionId } = req.body || {};
    if (typeof publicToken !== 'string' || !publicToken.startsWith(`public-${environment}-`) || publicToken.length > 512 ||
      !Array.isArray(accountIds) || !accountIds.length || accountIds.length > 100 ||
      accountIds.some(id => typeof id !== 'string' || !id || id.length > 256)) {
      return res.status(400).json({ error: 'A connection in the active environment and selected accounts are required.' });
    }
    let client, accessToken, cleanup = false;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const linkSession = await session(client, req.user.id, sessionId, 'new');
      if (linkSession.completed_at) {
        await client.query('COMMIT');
        return res.json({ connectionId: linkSession.connection_id, alreadySaved: true });
      }
      const linkToken = cipher.decrypt(linkSession.encrypted_link_token, tokenOwner(req.user.id, `link:${sessionId}`));
      const details = await request('/link/token/get', { link_token: linkToken });
      const results = (details.link_sessions || []).flatMap(entry => [
        ...(entry.results?.item_add_results || []),
        ...(entry.on_success ? [{ public_token: entry.on_success.public_token, ...entry.on_success.metadata }] : []),
      ]);
      const verified = results.find(result => result.public_token === publicToken);
      const institutionId = verified?.institution?.institution_id;
      if (!institutionId || !verified.accounts?.length || accountIds.some(id => !verified.accounts.some(account => account.id === id))) {
        throw problem(409, 'Plaid has not confirmed these accounts yet. Retry saving this connection shortly.');
      }
      let connection;
      if (linkSession.connection_id) {
        connection = await savedConnection(req.user.id, linkSession.connection_id, client);
        accessToken = connection.accessToken;
        if (connection.provider_institution_id !== institutionId) throw new Error('Institution mismatch');
      } else {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`plaid:${environment}:${req.user.id}:${institutionId}`]);
        const { rows: existing } = await client.query(`SELECT id FROM bank_connections
          WHERE user_id=$1 AND provider='plaid' AND (provider_institution_id=$2 OR provider_institution_id IS NULL)
          AND plaid_environment=$3`, [req.user.id, institutionId, environment]);
        if (existing.length) throw problem(409, 'This bank is already linked. Use Reconnect on the existing connection.', existing[0].id);
        if (!await checkQuota(client, req.user.id, 'bankConnections')) {
          throw problem(403, 'Your plan has reached its bank connection limit.');
        }
        const exchanged = await request('/item/public_token/exchange', { public_token: publicToken });
        accessToken = checkToken(exchanged.access_token, 'access'); cleanup = true;
        ({ rows: [connection] } = await client.query(`INSERT INTO bank_connections
          (user_id,institution_name,provider,provider_item_id,provider_institution_id,last_synced_at,plaid_environment,status)
          VALUES ($1,$2,'plaid',$3,$4,now(),$5,$6) RETURNING id`,
          [req.user.id, verified.institution.name || 'Linked bank', exchanged.item_id, institutionId, environment,
            environment === 'production' ? 'pending' : 'connected']));
        await client.query('INSERT INTO plaid_item_secrets (connection_id, encrypted_token) VALUES ($1,$2)',
          [connection.id, cipher.encrypt(accessToken, tokenOwner(req.user.id, connection.id))]);
        await client.query('UPDATE bank_connections SET access_token_secret_ref=$1 WHERE id=$2', [`plaid-item:${connection.id}`, connection.id]);
        if (environment === 'production') {
          // preserve the newly created live Item before loading accounts, so retries reuse it.
          await client.query('UPDATE plaid_link_sessions SET connection_id=$1 WHERE id=$2', [connection.id, sessionId]);
          await client.query('COMMIT'); cleanup = false;
          await client.query('BEGIN');
          const currentSession = await session(client, req.user.id, sessionId, 'new');
          if (currentSession.completed_at) {
            await client.query('COMMIT');
            return res.json({ connectionId: currentSession.connection_id, alreadySaved: true });
          }
        }
      }
      const data = await request('/accounts/get', { access_token: accessToken, options: { account_ids: [...new Set(accountIds)] } });
      if (data.item?.institution_id !== institutionId || data.accounts?.some(account => !accountIds.includes(account.account_id))) throw new Error('Institution or account mismatch');
      await saveAccounts(client, req.user.id, connection.id, data.accounts);
      await client.query(`UPDATE bank_connections SET status='connected',last_synced_at=now(),
        investments_status=CASE WHEN $4::text='investments' THEN 'authorized' ELSE investments_status END
        WHERE id=$1 AND user_id=$2 AND plaid_environment=$3`, [connection.id, req.user.id, environment, linkSession.requested_product]);
      await client.query('UPDATE plaid_link_sessions SET completed_at=now(),connection_id=$1 WHERE id=$2', [connection.id, sessionId]);
      await client.query('COMMIT'); cleanup = false;
      return res.status(201).json({ connectionId: connection.id, accountCount: data.accounts.length });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') cleanup = false;
      return sendError(res, error, 'Unable to save your bank connection. Please retry saving before starting a new connection.');
    } finally {
      client?.release();
      if (cleanup && accessToken) await request('/item/remove', { access_token: accessToken }).catch(() => {});
    }
  });

  router.post('/update', async (req, res) => {
    let client;
    try {
      client = await pool.connect(); await client.query('BEGIN');
      const linkSession = await session(client, req.user.id, req.body?.sessionId, 'update');
      if (!linkSession.completed_at) {
        const connection = await savedConnection(req.user.id, linkSession.connection_id);
        const item = await readItem(connection);
        if (item.error) throw problem(409, 'Your bank still requires authorization. Please try Reconnect again.');
        if (linkSession.requested_product === 'investments' && !item.consented_products?.includes('investments')) {
          throw problem(409, 'Investment access has not been authorized yet. Complete Enable investment activity and retry saving.');
        }
        const data = await request('/accounts/get', { access_token: connection.accessToken });
        await saveAccounts(client, req.user.id, connection.id, data.accounts);
        await client.query(`UPDATE bank_connections SET status='connected',provider_institution_id=$1,last_synced_at=now(),
          investments_status=CASE WHEN $5::text='investments' THEN 'authorized' ELSE investments_status END
          WHERE id=$2 AND user_id=$3 AND plaid_environment=$4`, [item.institution_id, connection.id, req.user.id, environment, linkSession.requested_product]);
        await client.query('UPDATE plaid_link_sessions SET completed_at=now() WHERE id=$1', [linkSession.id]);
      }
      await client.query('COMMIT');
      return res.json({ connectionId: linkSession.connection_id });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      return sendError(res, error, 'Unable to confirm reconnection. Please try again.');
    } finally { client?.release(); }
  });

  router.post('/sync', async (req, res) => {
    let client;
    const connectionId = req.body?.connectionId;
    try {
      if (!uuid(connectionId)) throw problem(400, 'A valid bank connection is required.');
      client = await pool.connect();
      await client.query('BEGIN');
      const connection = await savedConnection(req.user.id, connectionId, client, true);
      if (connection.status === 'pending') throw problem(409, 'Finish saving this bank connection or use Reconnect in Settings before syncing.');
      const { rows: types } = await client.query(`SELECT account_type FROM accounts
        WHERE connection_id=$1 AND user_id=$2 AND archived_at IS NULL`, [connectionId, req.user.id]);
      if (types.length && types.every(account => account.account_type === 'investment')) {
        throw problem(409, 'These are investment accounts. Use Enable investment activity, then Sync investment activity.');
      }
      const result = await syncTransactions(client, connection, request);
      await client.query('COMMIT');
      return res.json(result);
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error.code === '55P03') error = problem(409, 'This bank is already syncing. Please try again shortly.');
      if (error.plaidCode === 'ITEM_LOGIN_REQUIRED') {
        await pool.query(`UPDATE bank_connections SET status='reconnect_required' WHERE id=$1 AND user_id=$2 AND plaid_environment=$3`,
          [connectionId, req.user.id, environment]).catch(() => {});
        error = problem(409, 'Your bank needs authorization. Use Reconnect in Settings, then sync again.');
      }
      return sendError(res, error, 'Unable to sync transactions. Your saved transactions are unchanged. Please try again.');
    } finally { client?.release(); }
  });

  router.post('/investments/sync', async (req, res) => {
    let client;
    const connectionId = req.body?.connectionId;
    try {
      if (!uuid(connectionId)) throw problem(400, 'A valid bank connection is required.');
      client = await pool.connect(); await client.query('BEGIN');
      const connection = await savedConnection(req.user.id, connectionId, client, true);
      if (connection.status === 'pending') throw problem(409, 'Finish saving this connection before syncing.');
      const result = await syncInvestments(client, connection, request);
      await client.query('COMMIT');
      return res.json(result);
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error.code === '55P03') error = problem(409, 'This connection is already syncing. Please try again shortly.');
      let investmentStatus;
      if (['ADDITIONAL_CONSENT_REQUIRED', 'ACCESS_NOT_GRANTED'].includes(error.plaidCode)) {
        investmentStatus = 'consent_required';
        error = problem(409, 'Use Enable investment activity on your existing connection to authorize Investments, then sync again.');
      } else if (error.plaidCode === 'PRODUCT_NOT_READY') {
        investmentStatus = 'not_ready';
        error = problem(409, 'Plaid is preparing investment activity. Your saved history is unchanged. Sync again shortly.');
      } else if (['PRODUCT_NOT_ENABLED', 'PRODUCTS_NOT_SUPPORTED', 'NO_INVESTMENT_ACCOUNTS'].includes(error.plaidCode)) {
        investmentStatus = 'unsupported';
        error = problem(409, 'Investments is unavailable for this connection or Plaid team. Check product access in Plaid.');
      } else if (error.plaidCode === 'ITEM_LOGIN_REQUIRED') {
        await pool.query(`UPDATE bank_connections SET status='reconnect_required' WHERE id=$1 AND user_id=$2 AND plaid_environment=$3`,
          [connectionId, req.user.id, environment]).catch(() => {});
        error = problem(409, 'Your investment account needs authorization. Use Reconnect in Settings, then sync again.');
      }
      if (investmentStatus) await pool.query(`UPDATE bank_connections SET investments_status=$1
        WHERE id=$2 AND user_id=$3 AND plaid_environment=$4`, [investmentStatus, connectionId, req.user.id, environment]).catch(() => {});
      return sendError(res, error, 'Unable to sync investment activity. Your saved history is unchanged. Please try again.');
    } finally { client?.release(); }
  });

  router.get('/investments/transactions', async (req, res) => {
    const { beforeDate, beforeId, accountId } = req.query;
    if (accountId !== undefined && !uuid(accountId)) return res.status(400).json({ error: 'Invalid account.' });
    if ((beforeDate !== undefined || beforeId !== undefined) &&
        (typeof beforeDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate) || !uuid(beforeId))) {
      return res.status(400).json({ error: 'Invalid investment activity page.' });
    }
    try {
      const { rows } = await pool.query(`SELECT t.id,t.description,t.amount,t.currency,
        t.unofficial_currency AS "unofficialCurrency",t.activity_type AS type,t.activity_subtype AS subtype,
        t.security_name AS "securityName",t.ticker_symbol AS ticker,t.quantity,t.price,t.fees,
        t.cancel_transaction_id AS "cancelTransactionId",to_char(t.booked_on,'YYYY-MM-DD') AS date,
        a.id AS "accountId",a.name AS "accountName",b.institution_name AS institution
        FROM investment_transactions t JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id
        JOIN bank_connections b ON b.id=a.connection_id AND b.user_id=t.user_id
        JOIN plaid_item_secrets s ON s.connection_id=b.id
        WHERE t.user_id=$1 AND a.source='plaid' AND b.plaid_environment=$4
        AND ($5::uuid IS NULL OR a.id=$5::uuid)
        AND ($2::date IS NULL OR (t.booked_on,t.id)<($2::date,$3::uuid))
        ORDER BY t.booked_on DESC,t.id DESC LIMIT 51`, [req.user.id, beforeDate || null, beforeId || null, environment, accountId || null]);
      const transactions = rows.slice(0, 50), last = transactions.at(-1);
      return res.json({ transactions, nextCursor: rows.length > 50 ? { date: last.date, id: last.id } : null });
    } catch { return res.status(503).json({ error: 'Unable to load investment activity.' }); }
  });

  router.get('/budget-spending', async (req, res) => {
    const filter = spendingQuery(req.query);
    if (!filter) return res.status(400).json({ error: 'Choose valid accounts and a budget date range of up to one year.' });
    try {
      return res.json(await readBudgetSpending(pool, req.user.id, environment, filter));
    } catch { return res.status(503).json({ error: 'Unable to calculate budget spending. Please try again.' }); }
  });

  router.get('/transactions', async (req, res) => {
    const { beforeDate, beforeId, accountId } = req.query;
    if (accountId !== undefined && !uuid(accountId)) return res.status(400).json({ error: 'Invalid account.' });
    if ((beforeDate !== undefined || beforeId !== undefined) &&
        (typeof beforeDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(beforeDate) || !uuid(beforeId))) {
      return res.status(400).json({ error: 'Invalid transaction page.' });
    }
    try {
      const { rows } = await pool.query(`SELECT t.id,t.description,t.merchant_name AS "merchantName",
        t.amount,t.currency,t.kind,t.status,to_char(t.booked_on,'YYYY-MM-DD') AS date,
        COALESCE(c.name,initcap(replace(t.provider_category,'_',' ')),'Uncategorized') AS category,
        a.id AS "accountId",a.name AS "accountName",b.institution_name AS institution
        FROM transactions t JOIN accounts a ON a.id=t.account_id AND a.user_id=t.user_id
        JOIN bank_connections b ON b.id=a.connection_id AND b.user_id=t.user_id
        JOIN plaid_item_secrets s ON s.connection_id=b.id
        LEFT JOIN categories c ON c.id=t.category_id AND c.user_id=t.user_id
        WHERE t.user_id=$1 AND a.source='plaid' AND t.provider_synced_at IS NOT NULL AND t.status<>'removed'
        AND b.plaid_environment=$4
        AND ($5::uuid IS NULL OR a.id=$5::uuid)
        AND ($2::date IS NULL OR (t.booked_on,t.id)<($2::date,$3::uuid))
        ORDER BY t.booked_on DESC,t.id DESC LIMIT 51`, [req.user.id, beforeDate || null, beforeId || null, environment, accountId || null]);
      const transactions = rows.slice(0, 50);
      const last = transactions.at(-1);
      return res.json({ transactions, nextCursor: rows.length > 50 ? { date: last.date, id: last.id } : null });
    } catch { return res.status(503).json({ error: 'Unable to load bank transactions.' }); }
  });

  router.get('/connections', async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT b.id,b.institution_name AS institution,b.status,
        b.last_synced_at AS "lastSyncedAt",b.transactions_synced_at AS "transactionsSyncedAt",
        b.transactions_update_status AS "transactionsUpdateStatus",b.investments_synced_at AS "investmentsSyncedAt",
        b.investments_status AS "investmentsStatus",
        EXISTS(SELECT 1 FROM accounts a WHERE a.connection_id=b.id AND a.user_id=b.user_id
          AND a.archived_at IS NULL AND a.account_type='investment') AS "hasInvestmentAccounts",
        EXISTS(SELECT 1 FROM accounts a WHERE a.connection_id=b.id AND a.user_id=b.user_id
          AND a.archived_at IS NULL AND a.account_type<>'investment') AS "hasTransactionAccounts"
        FROM bank_connections b JOIN plaid_item_secrets s ON s.connection_id=b.id
        WHERE b.user_id=$1 AND b.provider='plaid' AND b.plaid_environment=$2 ORDER BY b.institution_name`, [req.user.id, environment]);
      return res.json({ connections: rows });
    } catch { return res.status(503).json({ error: 'Unable to load bank connections.' }); }
  });

  router.get('/accounts', async (req, res) => {
    try {
      const { rows } = await pool.query(`SELECT a.id, a.name, a.mask, a.currency,
        a.account_type AS "accountType",a.connection_id AS "connectionId",b.status AS "connectionStatus",
        a.current_balance AS "currentBalance", a.available_balance AS "availableBalance",
        a.balance_updated_at AS "balanceUpdatedAt", b.institution_name AS institution
        FROM accounts a JOIN bank_connections b ON a.connection_id=b.id AND a.user_id=b.user_id
        WHERE a.user_id=$1 AND a.source='plaid' AND b.status IN ('connected','reconnect_required') AND a.archived_at IS NULL
        AND b.plaid_environment=$2 ORDER BY b.institution_name, a.name`, [req.user.id, environment]);
      return res.json({ accounts: rows });
    } catch { return res.status(503).json({ error: 'Unable to load linked accounts.' }); }
  });
  return router;
}

module.exports = { createPlaid, tokenCipher, accountType };
