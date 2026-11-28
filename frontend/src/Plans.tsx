import { useEffect, useRef, useState } from 'react';
import PlanStatus from './PlanStatus';
import { demoPlanPrice, describePlan, formatPlanMoney, type BillingPeriod, type PlanAccount } from './planPresentation';
import './Plans.css';

type Props = {
  account: PlanAccount;
  refreshing: boolean;
  refreshError: string;
  onRefresh: () => void;
  onBack: () => void;
  onContinue: () => void;
};

function UpgradePreview({ period, onClose }: { period: BillingPeriod; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const price = demoPlanPrice(period);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => dialog?.close();
  }, []);
  function close() { ref.current?.close(); onClose(); }
  return <dialog ref={ref} className="fc-plan-upgrade-dialog" aria-labelledby="plan-upgrade-title" aria-describedby="plan-upgrade-note" onCancel={event => { event.preventDefault(); close(); }}>
    <header><h2 id="plan-upgrade-title">Upgrade to Premium</h2><button type="button" className="fc-plan-close" aria-label="Close upgrade preview" onClick={close}>×</button></header>
    <span className="fc-plan-tag">DEMO PRICING</span>
    <p className="fc-plan-price">{formatPlanMoney(price.cents)}<small> / {price.unit}</small></p>
    <p id="plan-upgrade-note">This is an example price. Checkout is not available yet, so you can’t purchase or change your plan here.</p>
    <button type="button" className="fc-plan-button fc-plan-primary" disabled aria-describedby="plan-upgrade-note">Checkout unavailable</button>
    <button type="button" className="fc-plan-button" onClick={close}>Keep current plan</button>
  </dialog>;
}

const previewFeatures = [
  ['Overview, Activity & Accounts', 'Available in this preview', 'Available in this preview'],
  ['Budget planning', 'Available in this preview', 'Available in this preview'],
  ['Bank-connection limits', 'Not set in this preview', 'Not set in this preview'],
  ['Premium-only permissions', 'To be confirmed', 'To be confirmed'],
];

export default function Plans({ account, refreshing, refreshError, onRefresh, onBack, onContinue }: Props) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const upgradeOpener = useRef<HTMLButtonElement>(null);
  const price = demoPlanPrice(period);
  const status = describePlan(account);
  return <div className="fc-plans">
    <button type="button" className="fc-plan-back" onClick={onBack}>← Back to settings</button>
    <header className="fc-plans-heading"><div><h1>View &amp; manage plans</h1><p>{status.summary}</p></div><button type="button" className="fc-plan-button" onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Refreshing status…' : 'Refresh plan status'}</button></header>
    {refreshing && <p className="fc-plan-feedback" role="status">Checking your account’s plan status…</p>}
    {refreshError && <p className="fc-plan-feedback fc-plan-error" role="alert">{refreshError} Your last known plan is shown below.</p>}
    <PlanStatus account={account} />
    <section className="fc-plan-preview-notice" aria-labelledby="plan-preview-title"><h2 id="plan-preview-title">Plan preview · Demo pricing</h2><p>Example prices only. Checkout and billing changes are unavailable in this preview.</p></section>
    <fieldset className="fc-plan-period"><legend>Demo billing period</legend><div>{(['monthly', 'yearly'] as const).map(value => <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === 'monthly' ? 'Monthly' : 'Yearly'}</button>)}</div></fieldset>
    <div className="fc-plan-options">
      <section className="fc-plan-option" aria-labelledby="free-plan-title"><header><h2 id="free-plan-title">Free</h2>{account.role === 'free' && <span className="fc-plan-tag">CURRENT PLAN</span>}</header><p>Your financial data, in one clear view.</p><p className="fc-plan-price">{formatPlanMoney(0)}<small> / month</small></p><p className="fc-plan-muted">Demo price · Example pricing only.</p>{account.role === 'free' ? <button type="button" className="fc-plan-button" onClick={onContinue}>Continue with Free</button> : <p className="fc-plan-card-note">Your current access is {status.label}. Switching plans is unavailable in this preview.</p>}</section>
      <section className="fc-plan-option fc-plan-premium" aria-labelledby="premium-plan-title"><header><h2 id="premium-plan-title">Premium</h2>{account.role === 'premium' ? <span className="fc-plan-tag">CURRENT PLAN</span> : <span className="fc-plan-premium-icon" aria-hidden="true" />}</header><p>{account.role === 'premium' ? 'Your current access, with demo pricing shown below.' : 'A preview of your next plan option.'}</p><p className="fc-plan-price">{formatPlanMoney(price.cents)}<small> / {price.unit}</small></p><p className="fc-plan-muted">Demo price{period === 'yearly' ? ` · Save ${formatPlanMoney(price.yearlySavings)} compared with 12 demo monthly payments.` : ' · Example pricing only.'}</p>{account.role === 'premium' ? <button type="button" className="fc-plan-button fc-plan-primary" disabled>Current Premium access</button> : <button type="button" ref={upgradeOpener} className="fc-plan-button fc-plan-primary" onClick={() => setUpgradeOpen(true)}>Upgrade to Premium</button>}<p className="fc-plan-card-note">{account.role === 'premium' ? 'Your Premium role does not confirm a payment, renewal date or subscription price.' : 'Opens a demo price preview. Checkout is unavailable.'}</p></section>
    </div>
    <section className="fc-plan-comparison" aria-labelledby="plan-comparison-title"><header><h2 id="plan-comparison-title">Compare your options</h2><p>This preview’s access · Final plan limits are pending.</p></header><table><caption className="fc-plan-sr-only">Current preview access for Free and Premium. These are not final plan permissions.</caption><thead><tr><th scope="col">Feature</th><th scope="col">Free</th><th scope="col">Premium</th></tr></thead><tbody>{previewFeatures.map(([feature, free, premium]) => <tr key={feature}><th scope="row">{feature}</th><td data-plan="Free">{free}</td><td data-plan="Premium">{premium}</td></tr>)}</tbody></table></section>
    <section className="fc-plan-billing" aria-labelledby="plan-billing-title"><h2 id="plan-billing-title">Billing details</h2><p id="plan-billing-note">Payment methods, renewal dates and invoices are unavailable in this preview.</p><button type="button" className="fc-plan-button" disabled aria-describedby="plan-billing-note">Manage billing unavailable</button></section>
    {upgradeOpen && <UpgradePreview period={period} onClose={() => { setUpgradeOpen(false); upgradeOpener.current?.focus(); }} />}
  </div>;
}
