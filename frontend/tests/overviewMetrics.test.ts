import assert from 'node:assert/strict';
import test from 'node:test';
import { overviewBudgetContext, overviewBudgetSummary } from '../src/overviewMetrics.ts';
import type { LinkedAccount } from '../src/plaid.ts';
import type { BudgetSpendingEntry } from '../src/budgetSpendingData.ts';

const account: LinkedAccount = { id: 'cash', name: 'Chequing', mask: '4821', currency: 'CAD', accountType: 'chequing',
  connectionId: 'bank', connectionStatus: 'connected', currentBalance: '1000', availableBalance: '900', balanceUpdatedAt: null, institution: 'Test bank' };
const card = { ...account, id: 'credit', accountType: 'credit_card' };
const plan = { start: '2026-11-20', budget: 100000, categories: [{ id: 1, name: 'Food & drink', allocation: 100000 }], accountIds: ['cash', 'credit'] };
const entry = { accountId: 'credit', name: 'Food & drink', subcategory: 'Groceries', merchant: 'Merchant', color: '#61d98f' };

test('Overview uses the saved Budget account selection, CAD eligibility and legacy defaults', () => {
  const accounts = [account, card, { ...account, id: 'usd', currency: 'USD' }, { ...account, id: 'investment', accountType: 'investment' }];
  const current = overviewBudgetContext({ ...plan, accountIds: ['credit', 'usd', 'missing'] }, accounts, '2026-11-27');
  assert.deepEqual(current.selectedIds, ['credit', 'usd', 'missing']);
  assert.deepEqual(current.availableIds, ['credit']);
  assert.equal(current.hasUnavailableAccount, true);
  assert.deepEqual(overviewBudgetContext({ ...plan, accountIds: undefined }, accounts, '2026-11-27').selectedIds, ['cash', 'credit']);
  assert.deepEqual(overviewBudgetContext({ ...plan, accountIds: [] }, accounts, '2026-11-27').selectedIds, []);
});

test('Overview matches Budget net spending and includes unallocated categories without counting other periods or accounts', () => {
  const entries: BudgetSpendingEntry[] = [
    { ...entry, id: 'purchase', amount: 30050, date: '2026-11-20' },
    { ...entry, id: 'refund', amount: -5050, date: '2026-11-27' },
    { ...entry, id: 'unallocated', name: 'Shopping', amount: 10000, date: '2026-11-26' },
    { ...entry, id: 'old', amount: 99999, date: '2026-11-19' },
    { ...entry, id: 'future', amount: 99999, date: '2026-11-28' },
    { ...entry, id: 'other', accountId: 'other', amount: 99999, date: '2026-11-26' },
  ];
  const result = overviewBudgetSummary(plan, [account, card], entries, '2026-11-27');
  assert.equal(result.spent, 35000);
  assert.equal(result.remaining, 65000);
  assert.equal(result.progress, 35);
  assert.deepEqual(result.categories, [{ name: 'Food & drink', amount: 25000 }, { name: 'Shopping', amount: 10000 }]);
});

test('scheduled plans count no spending, and over-budget or net-refund totals retain their exact cents', () => {
  const read = (amount: number) => overviewBudgetSummary(plan, [account, card], [{ ...entry, id: 'one', amount, date: '2026-11-27' }], '2026-11-27');
  assert.equal(read(100025).remaining, -25);
  assert.equal(read(100025).progress, 100);
  assert.equal(read(-1025).remaining, 101025);
  assert.equal(read(-1025).spent, -1025);
  assert.equal(read(-1025).progress, 0);
  const scheduled = overviewBudgetSummary({ ...plan, start: '2026-12-01' }, [account, card], [{ ...entry, id: 'one', amount: 50000, date: '2026-11-27' }], '2026-11-27');
  assert.equal(scheduled.spent, 0);
  assert.deepEqual(scheduled.categories, []);
});

test('reconnection warnings retain imported spending, while removed accounts are excluded as in Budget', () => {
  const reconnecting = { ...card, connectionStatus: 'reconnect_required' };
  assert.equal(overviewBudgetContext(plan, [account, reconnecting], '2026-11-27').hasUnavailableAccount, true);
  const entries = [{ ...entry, id: 'one', amount: 500, date: '2026-11-27' }];
  assert.equal(overviewBudgetSummary(plan, [account, reconnecting], entries, '2026-11-27').spent, 500);
  assert.equal(overviewBudgetSummary(plan, [account], entries, '2026-11-27').spent, 0);
});
