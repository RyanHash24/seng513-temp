import type { BudgetCategory } from './budgetState';

export type BudgetSpendingEntry = {
  id: string; accountId: string; name: string; merchant: string;
  subcategory: string; amount: number; date: string; color: string;
};

export function spendingInCycle(entries: BudgetSpendingEntry[], accountIds: string[], start: string, nextStart: string, today: string, scheduled = false) {
  if (scheduled) return [];
  const selected = new Set(accountIds);
  return entries.filter(entry => selected.has(entry.accountId) && entry.date >= start && entry.date < nextStart && entry.date <= today);
}

export function remainingTone(allocated: number, spent: number) {
  const remaining = allocated - spent;
  if (remaining < 0 || (allocated > 0 && remaining === 0)) return 'danger';
  if (allocated === 0) return 'neutral';
  return remaining / allocated <= 0.2 ? 'warning' : 'healthy';
}

export function categorySpending(category: BudgetCategory, entries: BudgetSpendingEntry[]) {
  const matching = entries.filter(entry => entry.name.trim().toLowerCase() === category.name.trim().toLowerCase());
  const targets = category.targets ?? (category.subcategory ? [{ name: category.subcategory, cents: category.allocation }] : []);
  const names = new Set([...targets.map(target => target.name), ...matching.map(entry => entry.subcategory || 'Other spending')]);
  return {
    spent: matching.reduce((total, entry) => total + entry.amount, 0),
    rows: Array.from(names, name => {
      const transactions = matching.filter(entry => (entry.subcategory || 'Other spending') === name);
      return { name, allocated: targets.find(target => target.name === name)?.cents ?? null,
        spent: transactions.reduce((total, entry) => total + entry.amount, 0),
        transactions: [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
      };
    }),
  };
}
