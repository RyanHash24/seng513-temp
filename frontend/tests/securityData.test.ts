import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordChangeResult, passwordValidation, securityDetails } from '../src/securityData.ts';

test('password validation preserves the existing policy and catches mismatch and unchanged credentials', () => {
  assert.match(passwordValidation('', 'abcdef!', 'abcdef!'), /current password/);
  for (const password of ['abcde!', 'abcdefg', 'a'.repeat(128) + '!']) assert.match(passwordValidation('current!', password, password), /7–128/);
  assert.match(passwordValidation('current!', 'abcdef!', 'different!'), /do not match/);
  assert.match(passwordValidation('current!', 'current!', 'current!'), /different from/);
  assert.equal(passwordValidation('current!', 'abcdef!', 'abcdef!'), '');
  assert.equal(passwordValidation('current!', 'a'.repeat(127) + '!', 'a'.repeat(127) + '!'), '');
});

test('security metadata accepts recorded timestamps or unknown history without inventing a password change date', () => {
  const data = { email: 'fixture@example.com', signInMethod: 'password', passwordChangedAt: null, sessionLifetimeMinutes: 15 };
  assert.equal(securityDetails(data).passwordChangedAt, null);
  assert.equal(securityDetails({ ...data, signInMethod: 'google' }).signInMethod, 'google');
  for (const change of [{ passwordChangedAt: 'invalid' }, { passwordChangedAt: undefined }, { sessionLifetimeMinutes: 0 }, { signInMethod: 'unknown' }]) {
    assert.throws(() => securityDetails({ ...data, ...change }));
  }
});

test('password update success requires both a real timestamp and confirmed session invalidation', () => {
  assert.equal(passwordChangeResult({ passwordChangedAt: '2026-11-27T20:00:00Z', otherSessionsSignedOut: true }), '2026-11-27T20:00:00Z');
  for (const value of [null, {}, { passwordChangedAt: 'invalid', otherSessionsSignedOut: true }, { passwordChangedAt: '2026-11-27T20:00:00Z', otherSessionsSignedOut: false }]) {
    assert.throws(() => passwordChangeResult(value));
  }
});
