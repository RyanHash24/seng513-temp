const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { verifyPassword } = require('./auth');
const { tokenCipher } = require('./plaid');

// Explicit export fields exclude authentication hashes, provider tokens, sync
// cursors and secret-store references, including fields added in later schemas.
const EXPORT_TABLES = [
  ['settings', 'user_settings', 'currency, timezone, theme, automatic_sync, budget_alert_threshold, weekly_summary'],
  ['notificationPreferences', 'notification_preferences', 'event_type, email_enabled, push_enabled'],
  ['registrationConsent', 'user_registration_consents', 'policy_version, accepted_at'],
  ['connections', 'bank_connections', 'id, institution_name, provider, status, last_synced_at, created_at, plaid_environment, transactions_synced_at, transactions_update_status, investments_synced_at, investments_status'],
  ['bankLinkSessions', 'plaid_link_sessions', 'id, mode, connection_id, expires_at, completed_at, plaid_environment, requested_product'],
  ['accounts', 'accounts', 'id, connection_id, name, account_type, source, scope, mask, currency, current_balance, available_balance, balance_updated_at, archived_at, created_at'],
  ['categoryGroups', 'category_groups', 'id, name, scope, display_order'],
  ['categories', 'categories', 'id, group_id, name, color, archived_at'],
  ['transactions', 'transactions', 'id, account_id, category_id, original_category_id, category_overridden, amount, currency, kind, status, scope, description, merchant_name, notes, booked_on, authorized_on, imported_at, created_at, provider_category, provider_synced_at'],
  ['investmentTransactions', 'investment_transactions', 'id, account_id, booked_on, description, activity_type, activity_subtype, security_name, ticker_symbol, quantity, price, fees, amount, currency, unofficial_currency, provider_synced_at'],
  ['budgets', 'budgets', 'id, month, scope, currency, expected_income, reserved_savings, created_at'],
  ['monthlyBudgetPlans', 'monthly_budget_plans', 'environment, revision, starts_on, limit_cents, categories, account_ids, saved_at'],
  ['budgetAllocations', 'budget_allocations', 'budget_id, category_id, allocated_amount'],
  ['savingsGoals', 'savings_goals', 'id, name, currency, target_amount, target_date, monthly_contribution, status, created_at'],
  ['savingsContributions', 'savings_contributions', 'id, goal_id, currency, amount, contributed_on, notes'],
  ['notifications', 'notifications', 'id, budget_id, category_id, event_type, title, message, read_at, created_at'],
];
const USER_EXPORT_FIELDS = 'id, first_name, last_name, email, phone, avatar_url, email_verified_at, access_role, trial_ends_at, premium_ends_at, created_at, password_changed_at';
// Delete children before parents; settings/consents/secrets also have cascades.
const DELETE_TABLES = ['plaid_link_sessions', 'notifications', 'savings_contributions', 'savings_goals',
  'budget_allocations', 'budgets', 'investment_transactions', 'transactions', 'accounts', 'categories',
  'category_groups', 'bank_connections', 'notification_preferences', 'user_registration_consents', 'user_settings'];

function problem(status, message) { return Object.assign(new Error(message), { status }); }

// This preview deliberately never selects a live Plaid host or live credentials.
// All links are checked/decrypted before the first external removal is attempted.
function prepareRemovals(connections, userId, config) {
  let cipher;
  return connections.filter(row => row.provider === 'plaid' && (row.provider_item_id || row.encrypted_token)).map(row => {
    if (row.plaid_environment !== 'sandbox') throw problem(409,
      'This account has a live bank connection. Deletion is unavailable in this Sandbox preview; contact the team.');
    if (config.env && config.env !== 'sandbox' || !config.clientId || !(config.sandboxSecret || config.secret) || !config.encryptionKey || !row.encrypted_token) {
      throw problem(503, 'Bank disconnection is unavailable. Your account has not been deleted. Please try again later.');
    }
    try {
      cipher ||= tokenCipher(config.encryptionKey);
      const token = cipher.decrypt(row.encrypted_token, `${userId}:${row.id}`);
      if (!token.startsWith('access-sandbox-')) throw new Error('Unexpected token environment');
      return token;
    } catch {
      throw problem(503, 'A bank connection could not be securely opened. Your account has not been deleted. Contact the team.');
    }
  });
}

function createPrivacy(pool, requireAuth, { origins = ['http://localhost:5173', 'http://127.0.0.1:5173'],
  clearSession, plaid = {}, fetchImpl = fetch } = {}) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (!origins.includes(req.get('Origin')) || !req.is('application/json')) {
      return res.status(403).json({ error: 'Request origin or content type is not allowed.' });
    }
    next();
  });
  router.use(requireAuth);
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, keyGenerator: req => req.user.id,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Too many privacy requests. Please try again in 15 minutes.' } }));
  router.use((req, res, next) => {
    const password = req.body?.password;
    if (typeof password !== 'string' || !password || password.length > 1024) {
      return res.status(400).json({ error: 'Enter your current password.' });
    }
    next();
  });

  router.post('/export', async (req, res) => {
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const { rows: [user] } = await client.query(`SELECT ${USER_EXPORT_FIELDS}, password_hash, session_version FROM users WHERE id=$1`, [req.user.id]);
      if (!user || (user.session_version ?? 0) !== req.sessionVersion) throw problem(401, 'Please log in again.');
      if (!await verifyPassword(req.body.password, user.password_hash)) throw problem(403, 'Current password is incorrect.');
      const publicUser = Object.fromEntries(USER_EXPORT_FIELDS.split(', ').map(field => [field, user[field]]));
      const data = { user: publicUser };
      for (const [name, table, fields] of EXPORT_TABLES) {
        // Constant identifiers above; every query is scoped to the authenticated
        // owner and intentionally includes all rows, dates and archived records.
        data[name] = (await client.query(`SELECT ${fields} FROM ${table} WHERE user_id=$1`, [req.user.id])).rows;
      }
      await client.query('COMMIT');
      const exportedAt = new Date().toISOString();
      res.attachment(`finclear-account-${exportedAt.slice(0, 10)}.json`);
      return res.json({ schemaVersion: 1, exportedAt, data });
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {});
      return res.status(error.status || 503).json({ error: error.status ? error.message : 'Unable to export your account data. Please try again.' });
    } finally { client?.release(); }
  });

  router.post('/delete-account', async (req, res) => {
    if (req.body.confirmation !== 'DELETE' || typeof req.body.email !== 'string' ||
      req.body.email.trim().toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(400).json({ error: 'Enter your account email and type DELETE to confirm.' });
    }
    let client, removalAttempted = false;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '2s'");
      const { rows: [user] } = await client.query('SELECT id, email, password_hash, session_version FROM users WHERE id=$1 FOR UPDATE NOWAIT', [req.user.id]);
      if (!user || (user.session_version ?? 0) !== req.sessionVersion) throw problem(401, 'Please log in again.');
      if (user.email.toLowerCase() !== req.body.email.trim().toLowerCase()) throw problem(409, 'Your account email changed. Reload this page before deleting your account.');
      if (!await verifyPassword(req.body.password, user.password_hash)) throw problem(403, 'Current password is incorrect.');
      // Parent and existing linking/sync locks prevent a connection from being
      // attached or synced while it is being removed. Foreign keys protect new
      // writes that were authenticated just before this transaction began.
      await client.query('SELECT id FROM plaid_link_sessions WHERE user_id=$1 FOR UPDATE NOWAIT', [req.user.id]);
      const { rows: connections } = await client.query(`SELECT b.id, b.provider, b.provider_item_id, b.plaid_environment, s.encrypted_token
        FROM bank_connections b LEFT JOIN plaid_item_secrets s ON s.connection_id=b.id
        WHERE b.user_id=$1 ORDER BY b.id FOR UPDATE OF b NOWAIT`, [req.user.id]);
      const tokens = prepareRemovals(connections, req.user.id, plaid);
      for (const token of tokens) {
        removalAttempted = true;
        const response = await fetchImpl('https://sandbox.plaid.com/item/remove', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Plaid-Version': '2020-09-14' },
          body: JSON.stringify({ client_id: plaid.clientId, secret: plaid.sandboxSecret || plaid.secret, access_token: token }),
          signal: AbortSignal.timeout(20_000),
        });
        const result = await response.json();
        // A previous attempt may have removed the Item before a later failure.
        if ((!response.ok && result.error_code !== 'ITEM_NOT_FOUND') ||
          (response.ok && (typeof result.request_id !== 'string' || !result.request_id))) throw new Error('Bank removal failed');
      }
      for (const table of DELETE_TABLES) await client.query(`DELETE FROM ${table} WHERE user_id=$1`, [req.user.id]);
      const deleted = await client.query('DELETE FROM users WHERE id=$1 RETURNING id', [req.user.id]);
      if (deleted.rowCount !== 1) throw new Error('Account deletion was not confirmed');
      await client.query('COMMIT');
      clearSession(res);
      return res.sendStatus(204);
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {});
      const busy = error.code === '55P03' || error.code === '40P01';
      return res.status(error.status || (busy ? 409 : 503)).json({ error: error.status ? error.message : busy
        ? 'Your account is busy with another operation. Please try again shortly.'
        : removalAttempted
          ? 'Deletion could not be completed. Some bank links may already be disconnected. Retry to finish; if you cannot sign in, contact the team to confirm the result.'
          : 'Unable to delete your account. Please try again.' });
    } finally { client?.release(); }
  });
  return router;
}

module.exports = { createPrivacy, EXPORT_TABLES, DELETE_TABLES };
