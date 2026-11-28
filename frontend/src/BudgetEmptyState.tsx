import type { ReactNode } from 'react';
import budgetIcon from './assets/navigation/budget-empty.svg';
import './Budgets.css';

export default function BudgetEmptyState({ onCreatePlan, loadError, onRetry, children }: {
  children?: ReactNode; onCreatePlan: () => void; loadError?: string; onRetry?: () => void;
}) {
  return <div className="budgets-page budget-empty-page">
    <header className="budget-empty-heading">
      <h1>Your monthly budget</h1>
      <p>A fresh start for your month.</p>
    </header>
    <section className="budget-panel budget-empty-card" aria-labelledby="budget-empty-title">
      <span className="budget-empty-icon"><img src={budgetIcon} alt="" /></span>
      <div className="budget-empty-message">
        <h2 id="budget-empty-title">No budget set yet</h2>
        <p>Choose your accounts, set a spending limit and allocate it to categories.</p>
      </div>
      <div className="budget-empty-action">
        <button type="button" className="budget-report-button budget-empty-create" onClick={onCreatePlan}>Create your monthly plan</button>
        <p>You can adjust your categories and amounts anytime.</p>
      </div>
    </section>
    {children}
    <footer className="budget-empty-footer">
      <span>Choose accounts</span><span aria-hidden="true">·</span>
      <span>Set a spending limit</span><span aria-hidden="true">·</span>
      <span>Allocate to categories</span>
    </footer>
    {loadError && <div className="budget-empty-error" role="alert">
      <p>{loadError}</p>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>}
  </div>;
}
