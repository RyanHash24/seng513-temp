import type { ReactNode } from 'react';
import { currentDay, type BudgetPlan } from './budgetState';
import { getBudgetCycle } from './budgetCycle';
import './BudgetScheduledState.css';

const dateFormat = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function BudgetScheduledState({ plan, onEdit, onReplace, children }: {
  children?: ReactNode; plan: BudgetPlan; onEdit: () => void; onReplace: () => void;
}) {
  const today = currentDay();
  const cycle = getBudgetCycle(plan.start, today);
  const allocated = plan.categories.reduce((sum, category) => sum + category.allocation, 0);

  return <div className="budgets-page budget-scheduled-page">
    <section className="budget-scheduled-card" aria-labelledby="budget-scheduled-title">
      <h1 id="budget-scheduled-title">Your budget is scheduled</h1>
      <p className="budget-scheduled-date"><time dateTime={plan.start}>{dateFormat.format(new Date(`${plan.start}T00:00:00Z`))}</time></p>
      <p>{cycle.label}</p>
      <p className="budget-scheduled-countdown"><span>Today · {shortDate.format(new Date(`${today}T00:00:00Z`))}</span><span aria-hidden="true">·</span><span>{cycle.daysUntilStart} {cycle.daysUntilStart === 1 ? 'day' : 'days'} until it starts</span></p>
      <p>Check back on your start day to track spending. Purchases before that date won’t count toward this plan.</p>
      <p className="budget-scheduled-total">Total allocated this cycle · {currency.format(allocated / 100)}</p>
      <button type="button" className="budget-scheduled-edit" onClick={onEdit}>Edit plan</button>
      <button type="button" className="budget-scheduled-replace" onClick={onReplace}>Create a replacement plan</button>
    </section>
    {children}
  </div>;
}
