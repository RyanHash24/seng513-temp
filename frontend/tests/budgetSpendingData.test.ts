import assert from 'node:assert/strict';
import test from 'node:test';
import { categorySpending, remainingTone, spendingInCycle } from '../src/budgetSpendingData.ts';

test('cycle math includes its first day, excludes the next cycle and future days, and respects account selections', () => {
  const common = { accountId: 'credit', name: 'Shopping', merchant: 'Shoes', color: '#61d98f', subcategory: 'Clothing & shoes' };
  const entries = [
    { ...common, id: 'before', amount: 10000, date: '2026-11-18' },
    { ...common, id: 'shoes', amount: 50000, date: '2026-11-19' },
    { ...common, id: 'checking', accountId: 'checking', amount: 30000, date: '2026-11-20' },
    { ...common, id: 'refund', amount: -5000, date: '2026-11-26' },
    { ...common, id: 'future', amount: 10000, date: '2026-11-27' },
    { ...common, id: 'next-cycle', amount: 10000, date: '2026-12-19' },
    { ...common, id: 'unselected', accountId: 'savings', amount: 10000, date: '2026-11-20' },
  ];
  const read = (start: string, today = '2026-11-26', ids = ['credit', 'checking']) => spendingInCycle(entries, ids, start, '2026-12-19', today);
  const total = (items: typeof entries) => items.reduce((sum, entry) => sum + entry.amount, 0);
  assert.equal(total(read('2026-11-19')), 75000);
  assert.equal(total(read('2026-11-20')), 25000);
  assert.equal(total(read('2026-11-19', '2026-11-26', ['checking'])), 30000);
  assert.equal(total(read('2026-11-19', '2026-12-19')), 85000);
  assert.equal(total(read('2026-11-19', '2026-11-26', [])), 0);
  assert.deepEqual(spendingInCycle(entries, ['credit'], '2026-11-28', '2026-12-28', '2026-11-26', true), []);
});

test('remaining amounts change state at the near-limit and exhausted boundaries', () => {
  assert.equal(remainingTone(10000, 7900), 'healthy');
  assert.equal(remainingTone(10000, 8000), 'warning');
  assert.equal(remainingTone(10000, 10000), 'danger');
  assert.equal(remainingTone(10000, 10001), 'danger');
  assert.equal(remainingTone(0, 0), 'neutral');
  assert.equal(remainingTone(0, 1), 'danger');
});

test('the breakdown keeps refunds and unplanned spending while excluding other categories', () => {
  const category = { id: 1, name: 'Home & bills', allocation: 165000, targets: [{ name: 'Rent', cents: 150000 }, { name: 'Phone', cents: 8000 }] };
  const common = { accountId: 'account-1', name: 'Home & bills', merchant: 'Merchant', color: '#61d98f' };
  const result = categorySpending(category, [
    { ...common, id: 'a', subcategory: 'Rent', amount: 120000, date: '2026-11-25' },
    { ...common, id: 'b', subcategory: 'Rent', amount: -10000, date: '2026-11-26' },
    { ...common, id: 'c', subcategory: '', amount: 500, date: '2026-11-24' },
    { ...common, id: 'd', name: 'Shopping', subcategory: 'Clothing', amount: 9999, date: '2026-11-25' },
  ]);
  assert.equal(result.spent, 110500);
  assert.deepEqual(result.rows.map(row => ({ name: row.name, allocated: row.allocated, spent: row.spent })), [
    { name: 'Rent', allocated: 150000, spent: 110000 },
    { name: 'Phone', allocated: 8000, spent: 0 },
    { name: 'Other spending', allocated: null, spent: 500 },
  ]);
  assert.deepEqual(result.rows[0].transactions.map(entry => entry.id), ['b', 'a']);
});
