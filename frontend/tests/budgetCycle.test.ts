import assert from 'node:assert/strict';
import test from 'node:test';
import { getBudgetCycle } from '../src/budgetCycle.ts';

test('a future plan uses the actual reference day for its countdown and full monthly period', () => {
  const cycle = getBudgetCycle('2026-11-28', '2026-11-26');
  assert.equal(cycle.scheduled, true);
  assert.equal(cycle.daysUntilStart, 2);
  assert.equal(cycle.label, 'Nov 28 – Dec 27, 2026');
});

test('the plan becomes active on its start day', () => {
  const cycle = getBudgetCycle('2026-11-28', '2026-11-28');
  assert.equal(cycle.scheduled, false);
  assert.equal(cycle.daysUntilStart, 0);
  assert.equal(cycle.firstDay.toISOString().slice(0, 10), '2026-11-28');
});

test('monthly periods handle short months and year boundaries', () => {
  const monthEnd = getBudgetCycle('2027-01-31', '2027-02-20');
  assert.equal(monthEnd.label, 'Jan 31 – Feb 27, 2027');
  assert.equal(getBudgetCycle('2026-12-28', '2026-11-26').label, 'Dec 28, 2026 – Jan 27, 2027');
});
