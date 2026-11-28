import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadActivityPeriod,
  filterActivity,
  calendarMonth,
  activityAmount,
  type ActivityTransaction,
  type ActivityFilters,
} from '../src/activityData.ts';

const period = calendarMonth('2026-11');
function entry(index: number, changes: Partial<ActivityTransaction> = {}): ActivityTransaction {
  return {
    id: String(1000 - index),
    merchantName: null,
    description: 'Merchant ' + index,
    accountId: index % 2 ? 'b' : 'a',
    accountName: 'Chequing',
    institution: 'Bank',
    amount: '-12.25',
    currency: 'CAD',
    category: index % 3 ? 'Food' : 'Transport',
    date: '2026-11-15',
    kind: 'expense',
    status: 'posted',
    ...changes,
  };
}
function filters(changes: Partial<ActivityFilters> = {}): ActivityFilters {
  return { accounts: [], categories: [], search: '', mode: '', ...period, ...changes };
}

test('period loading retrieves matches beyond page 100 and across a shared boundary date', async () => {
  const entries = Array.from({ length: 125 }, (_, index) => entry(index));
  let calls = 0;
  const rows = await loadActivityPeriod(period, async (cursor) => {
    const start = cursor ? entries.findIndex((item) => item.id === cursor.id) + 1 : 0;
    const transactions = entries.slice(start, start + 50);
    calls++;
    return {
      transactions,
      nextCursor:
        start + 50 < entries.length
          ? { date: transactions.at(-1)!.date, id: transactions.at(-1)!.id }
          : null,
    };
  });
  assert.equal(calls, 3);
  assert.equal(rows.length, 125);
  assert.equal(filterActivity(rows, [], filters({ search: 'Merchant 124' })).length, 1);
});

test('period loading excludes newer records and stops only below the first day', async () => {
  let calls = 0;
  const rows = await loadActivityPeriod(period, async () => {
    calls++;
    return {
      transactions: [
        entry(0, { date: '2026-12-01' }),
        entry(1, { date: '2026-11-01' }),
        entry(2, { date: '2026-10-31' }),
      ],
      nextCursor: { date: '2026-10-31', id: '998' },
    };
  });
  assert.equal(calls, 1);
  assert.deepEqual(
    rows.map((row) => row.id),
    ['999'],
  );
});

test('page failures and repeated cursors reject the result instead of publishing partial counts', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      loadActivityPeriod(period, async () => {
        if (calls++) throw new Error('Connection lost');
        return { transactions: [entry(1)], nextCursor: { date: '2026-11-15', id: '999' } };
      }),
    /Connection lost/,
  );
  await assert.rejects(
    () =>
      loadActivityPeriod(period, async () => ({
        transactions: [entry(1)],
        nextCursor: { date: '2026-11-15', id: '999' },
      })),
    /stopped advancing/,
  );
});

test('account/category unions intersect search and dates, and clearing restores the full period', () => {
  const rows = [entry(1), entry(2), entry(3), entry(4, { date: '2026-10-30' })];
  assert.deepEqual(
    filterActivity(rows, [], filters({ accounts: ['a'] })).map((row) => row.id),
    ['998'],
  );
  assert.equal(filterActivity(rows, [], filters({ accounts: ['a', 'b'] })).length, 3);
  assert.equal(
    filterActivity(
      rows,
      [],
      filters({
        accounts: ['a', 'b'],
        categories: ['Food', 'Transport'],
        search: 'Merchant 3',
        start: '2026-11-10',
      }),
    )[0].id,
    '997',
  );
  assert.equal(filterActivity(rows, [], filters()).length, 3);
});

test('all activity retains refunds/transfers, original signs/currencies, and leap-year periods', () => {
  const rows = [
    entry(1, { kind: 'refund', amount: '42.50' }),
    entry(2, { kind: 'transfer', amount: '-20' }),
    entry(3, { kind: 'income', amount: '120' }),
    entry(4, { category: 'Uncategorized' }),
  ];
  assert.equal(filterActivity(rows, [], filters()).length, 4);
  assert.equal(filterActivity(rows, [], filters({ mode: 'spending' })).length, 1);
  assert.equal(filterActivity(rows, [], filters({ mode: 'income' })).length, 1);
  assert.equal(filterActivity(rows, [], filters({ mode: 'uncategorized' })).length, 1);
  assert.match(activityAmount(rows[0]), /^\+/);
  assert.match(activityAmount(rows[1]), /^-/);
  assert.match(activityAmount(entry(5, { currency: 'USD' })), /USD/);
  assert.deepEqual(calendarMonth('2024-02'), { start: '2024-02-01', end: '2024-02-29' });
});
