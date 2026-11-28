export type Target = { name: string; cents: number };
export type BudgetCategory = {
  id: number; name: string; allocation: number; subcategory?: string; targets?: Target[];
};
export type BudgetPlan = {
  start: string; budget: number; categories: BudgetCategory[]; accountIds?: string[];
};

export function budgetStorageKey(userId: string) {
  return `finclear-monthly-budget-plan-v3:${userId}`;
}

// The old global key has no owner, so it must never become a new user's plan.
// Used only to recover an owner-specific plan saved before server persistence.
export function loadBudgetPlan(userId: string, storage?: Pick<Storage, 'getItem'>): BudgetPlan | null {
  try {
    const raw = (storage ?? localStorage).getItem(budgetStorageKey(userId));
    if (!raw) return null;
    const plan = JSON.parse(raw) as BudgetPlan | null;
    if (!plan || typeof plan.start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(plan.start) ||
        !Number.isFinite(Date.parse(plan.start)) || new Date(plan.start).toISOString().slice(0, 10) !== plan.start ||
        !Number.isSafeInteger(plan.budget) || plan.budget <= 0 || !Array.isArray(plan.categories) ||
        plan.categories.some(category => !category || typeof category.name !== 'string' ||
          !Number.isSafeInteger(category.id) || !Number.isSafeInteger(category.allocation) || category.allocation < 0 ||
          (category.subcategory !== undefined && typeof category.subcategory !== 'string') ||
          (category.targets !== undefined && (!Array.isArray(category.targets) || category.targets.some(t =>
            !t || typeof t.name !== 'string' || !Number.isSafeInteger(t.cents) || t.cents < 0)))) ||
        (plan.accountIds !== undefined && (!Array.isArray(plan.accountIds) || plan.accountIds.some(id => typeof id !== 'string')))) return null;
    return plan;
  } catch { return null; }
}

export function currentDay() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
