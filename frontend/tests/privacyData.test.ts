import test from 'node:test';
import assert from 'node:assert/strict';
import { accountExport, accountStorageKeys, browserAccountData, clearBrowserAccountData } from '../src/privacyData.ts';

test('account export includes only the current user’s browser records and preserves unreadable JSON', () => {
  const map = new Map([
    ['finclear-monthly-budget-plan-v3:owner', '{"budget":12300}'],
    ['finclear-settings:owner', 'incomplete-json'],
    ['finclear-settings:other', '{"email":"private@example.com"}'],
    ['finclear-appearance', '{"theme":"dark"}'],
  ]);
  const data = browserAccountData('owner', { getItem: key => map.get(key) ?? null });
  const result = JSON.parse(accountExport({ schemaVersion: 1, exportedAt: '2026-11-27T00:00:00Z', data: { user: { id: 'owner' }, transactions: [] } }, 'owner', data));
  assert.deepEqual(result.browserData.records['finclear-monthly-budget-plan-v3:owner'], { value: { budget: 12300 } });
  assert.deepEqual(result.browserData.records['finclear-settings:owner'], { rawValue: 'incomplete-json' });
  assert.equal(JSON.stringify(result).includes('private@example.com'), false);
  assert.deepEqual(Object.keys(result.browserData.records), accountStorageKeys('owner'));
});

test('malformed and mismatched account exports fail before a download is created', () => {
  for (const value of [null, {}, { schemaVersion: 1, exportedAt: 'invalid', data: { user: { id: 'owner' } } },
    { schemaVersion: 1, exportedAt: '2026-11-27T00:00:00Z', data: { user: { id: 'other' } } }]) {
    assert.throws(() => accountExport(value, 'owner', {}));
  }
  assert.throws(() => browserAccountData('owner', { getItem() { throw new Error('storage denied'); } }));
});

test('account cleanup leaves other users and device-wide appearance alone, reporting storage failures', () => {
  const removed: string[] = [];
  assert.equal(clearBrowserAccountData('owner', { removeItem: key => removed.push(key) }), true);
  assert.deepEqual(removed, accountStorageKeys('owner'));
  assert.equal(clearBrowserAccountData('owner', { removeItem() { throw new Error('storage denied'); } }), false);
});
