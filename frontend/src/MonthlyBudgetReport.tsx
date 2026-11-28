import { useState } from 'react';
import { currentDay, type BudgetPlan } from './budgetState';
import { plaidStatus } from './plaid';

export default function MonthlyBudgetReport({ plan }: { plan?: BudgetPlan | null }) {
  const currentMonth = currentDay().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setError('');
    try {
      const status = await plaidStatus();
      const response = await fetch(`/api/reports/monthly?${new URLSearchParams({ month })}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/pdf', 'Content-Type': 'application/json', 'X-Plaid-Environment': status.environment },
        body: JSON.stringify({ budget: plan && plan.start.slice(0, 7) <= month ? {
          start: plan.start, budget: plan.budget,
          categories: plan.categories.map(({ name, allocation }) => ({ name, allocation })),
          accountIds: plan.accountIds,
        } : null }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Unable to download your monthly report.');
      }
      if (!response.headers.get('Content-Type')?.startsWith('application/pdf')) {
        throw new Error('The server returned an invalid report. Please try again.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `FinClear_Monthly_Budget_${month}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to download your monthly report.');
    } finally {
      setDownloading(false);
    }
  }

  return <section className="budget-panel budget-report">
    <h3>Monthly Budget Report</h3>
    <p>Download a PDF of your personal account transactions, income and spending for a calendar month.</p>
    {plan && <p>Your current saved plan supplies the budget targets. Transactions come from your account history.</p>}
    <label className="budget-report-month">
      Report month
      <input type="month" value={month} max={currentMonth} disabled={downloading}
        onChange={event => { setMonth(event.target.value); setError(''); }} />
    </label>
    <button type="button" className="budget-report-button" disabled={downloading || !month}
      onClick={download}>{downloading ? 'Preparing Report...' : 'Download Monthly Report'}</button>
    {error && <p className="budget-report-error" role="alert">{error}</p>}
  </section>;
}
