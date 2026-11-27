import test from 'node:test';
import assert from 'node:assert/strict';
import { accountGroup, balanceTotals, currentBalance } from '../src/linkedAccountData.ts';
import type { LinkedAccount } from '../src/plaid.ts';

function account(current: string | null, currency = 'CAD', status = 'connected'): LinkedAccount {
  return { id: 'test', name: 'Test account', mask: '0000', currency,
    accountType: 'chequing', connectionId: 'test-connection', connectionStatus: status,
    currentBalance: current, availableBalance: null, balanceUpdatedAt: null, institution: 'Test Bank' };
}

test('saved account types map to the correct filter groups', () => {
  for (const type of ['cash', 'chequing', 'savings']) assert.equal(accountGroup(type), 'Cash');
  assert.equal(accountGroup('credit_card'), 'Credit cards');
  assert.equal(accountGroup('investment'), 'Investments');
  assert.equal(accountGroup('loan'), 'Loans');
  assert.equal(accountGroup('other'), 'Other');
});

test('summary balances keep currencies separate and add fractional values accurately', () => {
  assert.deepEqual(balanceTotals([account('0.10'), account('0.20'), account('100', 'USD')]),
    [{ currency: 'CAD', balance: 0.3 }, { currency: 'USD', balance: 100 }]);
});

test('unavailable and reconnecting balances are excluded instead of counted as zero or fresh', () => {
  assert.deepEqual(balanceTotals([account(null), account('100', 'CAD', 'reconnect_required')]), []);
  assert.equal(currentBalance(account('100', 'CAD', 'reconnect_required')), null);
  assert.equal(currentBalance(account('invalid')), null);
  assert.deepEqual(balanceTotals([account('0')]), [{ currency: 'CAD', balance: 0 }]);
});

test('cash overdrafts retain their sign and credit card credit balances do not offset amounts owed', () => {
  assert.deepEqual(balanceTotals([account('-25'), account('10')]), [{ currency: 'CAD', balance: -15 }]);
  assert.deepEqual(balanceTotals([account('-25'), account('10')], true), [{ currency: 'CAD', balance: 10 }]);
});
