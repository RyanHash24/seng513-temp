import assert from 'node:assert/strict';
import test from 'node:test';
import { demoPlanPrice, describePlan, formatPlanMoney } from '../src/planPresentation.ts';

const now = Date.parse('2026-11-27T15:00:00Z');
test('plan presentation follows the authenticated role instead of inferring access from a trial date', () => {
  assert.equal(describePlan({ role: 'free', trialEndsAt: '2026-12-09T00:00:00Z' }, now).role, 'free');
  const premium = describePlan({ role: 'premium', trialEndsAt: '2026-11-01T00:00:00Z' }, now);
  assert.equal(premium.role, 'premium');
  assert.equal(premium.timing, null);
  assert.equal(premium.trialDaysLeft, null);
});

test('trial countdown uses the real expiry instant and handles its exact boundary', () => {
  assert.equal(describePlan({ role: 'trial', trialEndsAt: '2026-11-28T15:00:00Z' }, now).trialDaysLeft, 1);
  assert.equal(describePlan({ role: 'trial', trialEndsAt: '2026-11-27T15:00:01Z' }, now).trialDaysLeft, 1);
  const expired = describePlan({ role: 'trial', trialEndsAt: '2026-11-27T15:00:00Z' }, now);
  assert.equal(expired.trialDaysLeft, 0);
  assert.equal(expired.badge, 'TRIAL ENDED');
  assert.equal(expired.role, 'trial');
  assert.match(expired.summary, /Refresh your plan status/);
});

test('missing and invalid trial dates stay unknown rather than inventing a new trial', () => {
  for (const trialEndsAt of [null, 'invalid']) {
    const trial = describePlan({ role: 'trial', trialEndsAt }, now);
    assert.equal(trial.trialDaysLeft, null);
    assert.equal(trial.timing, 'Your trial end date is unavailable.');
    assert.equal(trial.role, 'trial');
  }
});

test('expired-trial copy appears for a server-confirmed Free account without treating Premium as expired', () => {
  const free = describePlan({ role: 'free', trialEndsAt: '2026-11-26T15:00:00Z' }, now);
  assert.equal(free.badge, 'FREE');
  assert.match(free.timing!, /^Your trial ended /);
  assert.equal(describePlan({ role: 'free', trialEndsAt: null }, now).timing, null);
});

test('demo monthly and annual prices preserve cents and explain annual savings accurately', () => {
  assert.deepEqual(demoPlanPrice('monthly'), { cents: 799, unit: 'month', yearlySavings: 1589 });
  assert.deepEqual(demoPlanPrice('yearly'), { cents: 7999, unit: 'year', yearlySavings: 1589 });
  assert.match(formatPlanMoney(7999), /CAD\s*79\.99/);
});
