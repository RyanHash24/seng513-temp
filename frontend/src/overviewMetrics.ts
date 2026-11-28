import type { LinkedAccount } from './plaid';
import type { BudgetPlan } from './budgetState';
import { getBudgetCycle } from './budgetCycle.ts';
import { spendingInCycle, type BudgetSpendingEntry } from './budgetSpendingData.ts';

// Compose the same account selection and cycle rules used by Budget.
export function overviewBudgetContext(plan: BudgetPlan | null, accounts: LinkedAccount[], today: string) {
  const eligible = accounts.filter(account => account.currency === 'CAD' &&
    ['cash', 'chequing', 'savings', 'credit_card'].includes(account.accountType));
  const connectedIds = eligible.filter(account => account.connectionStatus === 'connected').map(account => account.id);
  const selectedIds = plan?.accountIds ?? connectedIds;
  return {
    cycle: plan ? getBudgetCycle(plan.start, today) : null,
    selectedIds,
    availableIds: selectedIds.filter(id => eligible.some(account => account.id === id)),
    hasUnavailableAccount: selectedIds.some(id => !connectedIds.includes(id)),
  };
}

export function overviewBudgetSummary(plan: BudgetPlan, accounts: LinkedAccount[], entries: BudgetSpendingEntry[], today: string) {
  const context = overviewBudgetContext(plan, accounts, today);
  const cycle = context.cycle!;
  const included = spendingInCycle(entries, context.availableIds, cycle.firstDay.toISOString().slice(0, 10),
    cycle.nextStart.toISOString().slice(0, 10), today, cycle.scheduled);
  const spent = included.reduce((sum, entry) => sum + entry.amount, 0);
  const groups = new Map<string, number>();
  for (const entry of included) groups.set(entry.name, (groups.get(entry.name) ?? 0) + entry.amount);
  return {
    spent,
    remaining: plan.budget - spent,
    progress: Math.max(0, Math.min(100, spent / plan.budget * 100)),
    categories: [...groups].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name)),
  };
}
