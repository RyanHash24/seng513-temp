import type { LinkedAccount } from './plaid';

export const accountFilters = ['All accounts', 'Cash', 'Credit cards', 'Investments', 'Loans', 'Other'] as const;
export type AccountFilter = (typeof accountFilters)[number];
export type AccountGroup = Exclude<AccountFilter, 'All accounts'>;

export function accountGroup(type: string): AccountGroup {
  if (['cash', 'chequing', 'savings'].includes(type)) return 'Cash';
  if (type === 'credit_card') return 'Credit cards';
  if (type === 'investment') return 'Investments';
  if (type === 'loan') return 'Loans';
  return 'Other';
}

export function currentBalance(account: LinkedAccount): number | null {
  if (account.connectionStatus !== 'connected' || account.currentBalance === null) return null;
  const amount = Number(account.currentBalance);
  return Number.isFinite(amount) ? amount : null;
}

// Keep different currencies separate and add in cents to avoid decimal drift.
export function balanceTotals(accounts: LinkedAccount[], amountOwed = false) {
  const totals = new Map<string, number>();
  for (const account of accounts) {
    const balance = currentBalance(account);
    if (balance === null) continue;
    const cents = Math.round((amountOwed ? Math.max(0, balance) : balance) * 100);
    totals.set(account.currency, (totals.get(account.currency) ?? 0) + cents);
  }
  return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, cents]) => ({ currency, balance: cents / 100 }));
}

export function formatAccountMoney(balance: number | null, currency: string) {
  return balance === null ? '—' : new Intl.NumberFormat('en-CA', {
    style: 'currency', currency, currencyDisplay: 'code',
  }).format(balance);
}
