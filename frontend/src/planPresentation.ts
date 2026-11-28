import type { AuthUser } from './auth';

export type PlanAccount = Pick<AuthUser, 'role' | 'trialEndsAt'>;
export type BillingPeriod = 'monthly' | 'yearly';

// Display examples only. These prices never change access or initiate a payment.
export const demoPricing = { currency: 'CAD', monthlyCents: 799, yearlyCents: 7999 } as const;
export const formatPlanMoney = (cents: number) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: demoPricing.currency, currencyDisplay: 'code',
}).format(cents / 100);

export function demoPlanPrice(period: BillingPeriod) {
  return {
    cents: period === 'monthly' ? demoPricing.monthlyCents : demoPricing.yearlyCents,
    unit: period === 'monthly' ? 'month' : 'year',
    yearlySavings: demoPricing.monthlyCents * 12 - demoPricing.yearlyCents,
  };
}

export function describePlan(account: PlanAccount, now = Date.now()) {
  const expiry = account.trialEndsAt ? Date.parse(account.trialEndsAt) : NaN;
  const hasDate = Number.isFinite(expiry);
  const trialExpired = hasDate && expiry <= now;
  const trialDaysLeft = hasDate ? Math.max(0, Math.ceil((expiry - now) / 86_400_000)) : null;
  const endLabel = hasDate ? new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(expiry)) : null;
  const endPunctuation = endLabel?.endsWith('.') ? '' : '.';
  const shortEndLabel = hasDate ? new Intl.DateTimeFormat('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(expiry)) : null;

  if (account.role === 'premium') return {
    role: account.role, label: 'Premium', badge: 'PREMIUM', trialDaysLeft: null,
    summary: 'Your account has Premium access.',
    timing: null, sidebar: 'Your Premium access is enabled.',
  };
  if (account.role === 'free') return {
    role: account.role, label: 'Free', badge: 'FREE', trialDaysLeft: null,
    summary: 'You’re using FinClear Free.',
    timing: trialExpired ? `Your trial ended ${endLabel}${endPunctuation}` : null,
    sidebar: 'Your financial data, clearly in view.',
  };
  return {
    role: account.role, label: 'Free trial', badge: trialExpired ? 'TRIAL ENDED' : 'FREE TRIAL', trialDaysLeft,
    summary: trialExpired ? 'Your trial has ended. Refresh your plan status to check your current access.' : 'Your free trial is active.',
    timing: endLabel ? `Your trial ${trialExpired ? 'ended' : 'ends'} ${endLabel}${endPunctuation}` : 'Your trial end date is unavailable.',
    sidebar: trialExpired ? 'Refresh your plan status.' : shortEndLabel ? `Your trial ends ${shortEndLabel}.` : 'Your free trial is active.',
  };
}
