import assert from 'node:assert/strict';
import test from 'node:test';
import { budgetStorageKey, loadBudgetPlan } from '../src/budgetState.ts';

const plan = { start: '2026-11-26', budget: 100000, categories: [{ id: 1, name: 'Food', allocation: 20000 }], accountIds: [] };
function storage(values: Record<string, string>) { return { getItem: (key: string) => values[key] ?? null }; }

test('fresh users do not inherit a sample plan or the old shared browser plan', () => {
  assert.equal(loadBudgetPlan('new-user', storage({ 'finclear-monthly-budget-plan-v2': JSON.stringify(plan) })), null);
});

test('each user sees only the plan saved under their own key', () => {
  const saved = storage({ [budgetStorageKey('alice')]: JSON.stringify(plan) });
  assert.deepEqual(loadBudgetPlan('alice', saved), plan);
  assert.equal(loadBudgetPlan('bob', saved), null);
});

test('a valid plan can exist before any account is linked', () => {
  assert.deepEqual(loadBudgetPlan('alice', storage({ [budgetStorageKey('alice')]: JSON.stringify(plan) })), plan);
});

test('missing, corrupted and invalid plans never become a fictitious active budget', () => {
  for (const raw of ['null', '{}', '{bad', JSON.stringify({ ...plan, budget: -100 }), JSON.stringify({ ...plan, categories: [null] })]) {
    assert.equal(loadBudgetPlan('alice', storage({ [budgetStorageKey('alice')]: raw })), null);
  }
});
