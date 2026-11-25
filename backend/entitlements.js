// Proposed prototype policy: confirm these limits with the team before release.
function effectiveRole(row, now = new Date()) {
  if (row.access_role === 'trial' && (!row.trial_ends_at || new Date(row.trial_ends_at) <= now)) return 'free';
  if (row.access_role === 'premium' && row.premium_ends_at && new Date(row.premium_ends_at) <= now) return 'free';
  return row.access_role;
}
function permissions(role) {
  const full = role === 'trial' || role === 'premium';
  return { maxBudgetCategories: full ? null : 3, maxSavingsGoals: full ? null : 2,
    maxBankConnections: full ? null : 1, monthlyReports: full, businessAccounts: full };
}
function requirePermission(feature) {
  return (req, res, next) => req.user?.emailVerified && req.user.permissions?.[feature] === true
    ? next() : res.status(403).json({ error: 'Your current plan does not include this feature.' });
}
// Call INSIDE a transaction before inserting, using the same client. Locking the
// user row serializes concurrent quota checks and reads the current plan again.
async function checkQuota(client, userId, resource, scope = 'personal', budgetId) {
  const rules = {
    bankConnections: ['maxBankConnections', "SELECT count(*) FROM bank_connections WHERE user_id=$1 AND status <> 'disconnected'"],
    savingsGoals: ['maxSavingsGoals', "SELECT count(*) FROM savings_goals WHERE user_id=$1 AND status = 'active'"],
    budgetCategories: ['maxBudgetCategories', "SELECT count(*) FROM budget_allocations a JOIN budgets b ON b.id=a.budget_id AND b.user_id=a.user_id WHERE a.user_id=$1 AND b.id=$2"],
  };
  if (!Object.hasOwn(rules, resource)) throw new Error('Unknown quota');
  const { rows: [row] } = await client.query('SELECT access_role, trial_ends_at, premium_ends_at, email_verified_at FROM users WHERE id=$1 FOR UPDATE', [userId]);
  if (!row?.email_verified_at || row.access_role === 'guest') return false;
  const policy = permissions(effectiveRole(row));
  if (scope === 'business' && !policy.businessAccounts) return false;
  const [key, sql] = rules[resource];
  if (policy[key] === null) return true;
  const { rows: [count] } = await client.query(sql, resource === 'budgetCategories' ? [userId, budgetId] : [userId]);
  return Number(count.count) < policy[key];
}
module.exports = { effectiveRole, permissions, requirePermission, checkQuota };
