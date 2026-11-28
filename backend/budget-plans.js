const express = require('express');
const { isDeepStrictEqual } = require('node:util');
const { permissions, effectiveRole } = require('./entitlements');
const { validDate, uuid } = require('./budget-spending');

const problem = (status, message) => Object.assign(new Error(message), { status });
const cents = value => Number.isSafeInteger(value) && value >= 0;
const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;
const distinct = values => new Set(values).size === values.length;

function validatedPlan(input) {
  if (!input || !validDate(input.start) || input.start.startsWith('0000') || !cents(input.budget) || !input.budget)
    throw problem(422, 'Enter a valid start date and positive spending limit.');
  if (!Array.isArray(input.accountIds) || input.accountIds.length > 100 || !input.accountIds.every(uuid))
    throw problem(422, 'Select valid accounts for this budget.');
  const accountIds = input.accountIds.map(id => id.toLowerCase());
  if (!distinct(accountIds)) throw problem(422, 'An account can only be selected once.');
  if (!Array.isArray(input.categories) || !input.categories.length || input.categories.length > 100)
    throw problem(422, 'Select between 1 and 100 budget categories.');

  const categories = input.categories.map(category => {
    if (!category || !Number.isSafeInteger(category.id) || !validName(category.name) || !cents(category.allocation))
      throw problem(422, 'Each category needs a name and a valid allocation in cents.');
    const targets = category.targets ?? (category.subcategory ? [{ name: category.subcategory, cents: category.allocation }] : []);
    if (!Array.isArray(targets) || targets.length > 100 || targets.some(t => !t || !validName(t.name) || !cents(t.cents)))
      throw problem(422, 'Each expense needs a name and a valid amount in cents.');
    if (!distinct(targets.map(t => t.name.trim().toLowerCase())))
      throw problem(422, 'Each expense name must be unique within its category.');
    if (targets.length && targets.reduce((sum, t) => sum + BigInt(t.cents), 0n) !== BigInt(category.allocation))
      throw problem(422, 'Expense amounts must add up to their category allocation.');
    return { id: category.id, name: category.name.trim(), allocation: category.allocation,
      targets: targets.map(t => ({ name: t.name.trim(), cents: t.cents })) };
  });
  if (!distinct(categories.map(c => c.id)) || !distinct(categories.map(c => c.name.toLowerCase())))
    throw problem(422, 'Each budget category must be unique.');
  if (categories.reduce((sum, c) => sum + BigInt(c.allocation), 0n) !== BigInt(input.budget))
    throw problem(422, 'Left to assign must be exactly $0.00 before saving.');
  return { start: input.start, budget: input.budget, categories, accountIds };
}

async function readCurrent(client, userId, environment) {
  const { rows: [row] } = await client.query(`SELECT revision, to_char(starts_on, 'YYYY-MM-DD') AS start,
    limit_cents, categories, account_ids FROM monthly_budget_plans
    WHERE user_id=$1 AND environment=$2 ORDER BY revision DESC LIMIT 1`, [userId, environment]);
  const plan = row ? { start: row.start, budget: Number(row.limit_cents), categories: row.categories,
    accountIds: row.account_ids } : null;
  return { environment, revision: row?.revision ?? 0, plan };
}

async function savePlan(pool, userId, sessionVersion, environment, revision, plan) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the owner even for the first save, when there is no plan row to lock.
    const { rows: [owner] } = await client.query(`SELECT access_role, trial_ends_at, premium_ends_at, email_verified_at, session_version
      FROM users WHERE id=$1 FOR UPDATE`, [userId]);
    if (!owner || owner.session_version !== sessionVersion) throw problem(401, 'Please log in again.');
    if (!owner.email_verified_at || owner.access_role === 'guest') throw problem(403, 'A verified account is required.');
    const current = await readCurrent(client, userId, environment);
    if (current.revision !== revision) {
      if (current.revision === revision + 1 && isDeepStrictEqual(plan, current.plan)) {
        await client.query('COMMIT');
        return current; // A retry after losing the first save response.
      }
      throw problem(409, 'Your saved plan changed on another device. Reopen the latest plan before saving.');
    }
    const policy = permissions(effectiveRole(owner));
    if (policy.maxBudgetCategories !== null && plan.categories.length > policy.maxBudgetCategories)
      throw problem(403, `Your plan allows up to ${policy.maxBudgetCategories} budget categories.`);
    if (plan.accountIds.length) {
      const { rowCount } = await client.query(`SELECT a.id FROM accounts a
        JOIN bank_connections b ON b.id=a.connection_id AND b.user_id=a.user_id
        WHERE a.user_id=$1 AND a.id=ANY($2::uuid[]) AND b.plaid_environment=$3 AND b.provider='plaid'
        AND a.archived_at IS NULL AND a.source='plaid' AND a.currency='CAD'
        AND (a.scope='personal' OR $4::boolean) AND b.status IN ('connected','reconnect_required')
        AND a.account_type IN ('cash','chequing','savings','credit_card') FOR SHARE OF a,b`,
      [userId, plan.accountIds, environment, policy.businessAccounts]);
      if (rowCount !== plan.accountIds.length) throw problem(422, 'An included account is unavailable. Review your account selection.');
    }
    await client.query(`INSERT INTO monthly_budget_plans
      (user_id, environment, revision, starts_on, limit_cents, categories, account_ids)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [userId, environment, revision + 1, plan.start,
      plan.budget, JSON.stringify(plan.categories), plan.accountIds]);
    await client.query('COMMIT');
    return { environment, revision: revision + 1, plan };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

function createBudgetPlans(pool, requireVerified, { origins = ['http://localhost:5173', 'http://127.0.0.1:5173'], environment = 'sandbox' } = {}) {
  const router = express.Router();
  router.use(requireVerified, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Another tab can change the shared session cookie while this editor is open.
    if (req.get('X-FinClear-User') !== req.user.id) return res.status(409).json({ error: 'Your sign-in changed. Reload this page.' });
    if (!['sandbox', 'production'].includes(environment)) return res.status(503).json({ error: 'Budget environment unavailable.' });
    next();
  });
  router.get('/', async (req, res) => {
    try { res.json(await readCurrent(pool, req.user.id, environment)); }
    catch { res.status(503).json({ error: 'Unable to load your saved budget. Please try again.' }); }
  });
  router.put('/', async (req, res) => {
    if (!origins.includes(req.get('Origin')) || !req.is('application/json'))
      return res.status(403).json({ error: 'Request origin or content type is not allowed.' });
    const { revision, plan, environment: expectedEnvironment } = req.body ?? {};
    if (expectedEnvironment !== environment) return res.status(409).json({ error: 'The bank environment changed. Reload this page.' });
    if (!Number.isSafeInteger(revision) || revision < 0) return res.status(400).json({ error: 'A valid budget revision is required.' });
    try { res.json(await savePlan(pool, req.user.id, req.sessionVersion, environment, revision, validatedPlan(plan))); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Unable to save your budget. Please try again.' }); }
  });
  return router;
}

module.exports = { createBudgetPlans, validatedPlan };
