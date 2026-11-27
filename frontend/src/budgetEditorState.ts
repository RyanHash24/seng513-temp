import type { BudgetCategory, Target } from './budgetState';

export type DraftCategory = Omit<BudgetCategory, 'allocation'> & { allocation: string };
export type PlanEditorState = {
  mode: 'create' | 'edit' | 'replace';
  start: string;
  budget: string;
  categories: DraftCategory[];
  accountIds: string[];
};

export function allocationError(budget: number, allocations: number[]): string {
  if (!Number.isSafeInteger(budget) || budget <= 0 ||
    allocations.some(amount => !Number.isSafeInteger(amount) || amount < 0)) {
    return 'Enter a valid spending limit and category amounts.';
  }
  const allocated = allocations.reduce((total, amount) => total + amount, 0);
  if (!Number.isSafeInteger(allocated)) return 'Enter valid category amounts.';
  const left = budget - allocated;
  if (left === 0) return '';
  const amount = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(left) / 100);
  return left > 0
    ? `Assign the remaining ${amount} to your categories before saving. Left to assign must be $0.00.`
    : `Reduce allocations by ${amount} before saving. Left to assign must be $0.00.`;
}

export function scaleTargets(targets: Target[], total: number): Target[] {
  if (targets.length === 0) return [];
  const previousTotal = targets.reduce((sum, target) => sum + target.cents, 0);
  const portions = targets.map((target, index) => {
    const exact = previousTotal > 0 ? total * target.cents / previousTotal : total / targets.length;
    return { index, cents: Math.floor(exact), fraction: exact - Math.floor(exact) };
  });
  const remainder = total - portions.reduce((sum, portion) => sum + portion.cents, 0);
  const ranked = [...portions].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const portion of ranked.slice(0, remainder)) portion.cents += 1;
  return targets.map(({ name }, index) => ({ name, cents: portions[index].cents }));
}

export function setExpenseAmount(category: DraftCategory, name: string, cents: number): DraftCategory {
  const targets = (category.targets ?? []).map(target => target.name === name ? { ...target, cents } : target);
  return { ...category, targets, allocation: String(targets.reduce((sum, target) => sum + target.cents, 0) / 100) };
}
