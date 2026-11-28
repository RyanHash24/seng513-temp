import { demoPricing, describePlan, formatPlanMoney, type PlanAccount } from './planPresentation';
import './Plans.css';

export default function PlanStatus({ account, onViewPlans }: { account: PlanAccount; onViewPlans?: () => void }) {
  const status = describePlan(account);
  return <section className="fc-plan-current" aria-label="Current plan">
    <header><h2>{status.label}</h2><span className="fc-plan-tag">{status.role === 'trial' && status.trialDaysLeft !== null
      ? status.trialDaysLeft > 0 ? `${status.trialDaysLeft} ${status.trialDaysLeft === 1 ? 'day' : 'days'} left` : 'Trial ended'
      : 'Current access'}</span></header>
    <p>{status.summary}</p>
    {status.timing && <p className="fc-plan-muted">{status.timing}</p>}
    <p className="fc-plan-muted">Plan-specific limits are being finalised. Your current workspace features remain available in this preview.</p>
    {onViewPlans && <button type="button" className="fc-plan-button" onClick={onViewPlans}>Compare plans</button>}
  </section>;
}

export function SubscriptionPlans({ account, onViewPlans }: { account: PlanAccount; onViewPlans?: () => void }) {
  return <div className="fc-subscription-plans">
    <PlanStatus account={account} onViewPlans={onViewPlans} />
    <section className="fc-plan-option fc-plan-premium" aria-label="Premium pricing preview">
      <header><h2>FinClear Premium</h2><span className="fc-plan-premium-icon" aria-hidden="true" /></header>
      <span className="fc-plan-tag">DEMO PRICING</span>
      <p className="fc-plan-price">{formatPlanMoney(demoPricing.monthlyCents)}<small> / month</small></p>
      <p className="fc-plan-muted">Or {formatPlanMoney(demoPricing.yearlyCents)} / year · Example prices only.</p>
      <p className="fc-plan-card-note">Feature limits are being finalised. Checkout and billing changes are unavailable.</p>
      {onViewPlans && <button type="button" className="fc-plan-button fc-plan-primary" onClick={onViewPlans}>{account.role === 'premium' ? 'View plan details' : 'Explore Premium'}</button>}
    </section>
  </div>;
}
