import assert from 'node:assert/strict';
import test from 'node:test';
import { allocationError, scaleTargets, setExpenseAmount } from '../src/budgetEditorState.ts';

test('a plan can only save when allocations match the spending limit to the cent', () => {
  assert.match(allocationError(360000, [355000]), /remaining \$50\.00/);
  assert.match(allocationError(360000, [359999]), /remaining \$0\.01/);
  assert.match(allocationError(360000, [360001]), /Reduce allocations by \$0\.01/);
  assert.equal(allocationError(360000, [165000, 195000]), '');
  assert.equal(allocationError(30, [10, 20]), '');
  for (const [budget, allocations] of [[0, []], [NaN, [100]], [100, [-1, 101]], [100, [NaN]]]) {
    assert.notEqual(allocationError(budget as number, allocations as number[]), '');
  }
});

test('editing one expense updates the category total without changing the other expenses', () => {
  const category = { id: 1, name: 'Home & bills', allocation: '1650', targets: [
    { name: 'Rent', cents: 150000 }, { name: 'Phone', cents: 8000 }, { name: 'Wi-Fi', cents: 7000 },
  ] };
  const updated = setExpenseAmount(category, 'Phone', 9500);
  assert.equal(updated.allocation, '1665');
  assert.deepEqual(updated.targets, [
    { name: 'Rent', cents: 150000 }, { name: 'Phone', cents: 9500 }, { name: 'Wi-Fi', cents: 7000 },
  ]);
  assert.equal(category.allocation, '1650');
});

test('resizing a category preserves its proportions and accounts for every cent', () => {
  const updated = scaleTargets([{ name: 'A', cents: 100 }, { name: 'B', cents: 100 }, { name: 'C', cents: 100 }], 100);
  assert.deepEqual(updated.map(target => target.cents), [34, 33, 33]);
  assert.equal(updated.reduce((total, target) => total + target.cents, 0), 100);
});
