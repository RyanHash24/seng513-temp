import { useEffect, useState, type FormEvent } from "react";
import { useSavedAccounts } from "./useSavedAccounts";
import { useBudgetSpending } from "./useBudgetSpending";
import { budgetStorageKey, currentDay, loadBudgetPlan, type BudgetPlan as Plan, type BudgetCategory as Category, type Target } from "./budgetState";
import BudgetEmptyState from "./BudgetEmptyState";
import BudgetScheduledState from "./BudgetScheduledState";
import { getBudgetCycle as getCycle } from "./budgetCycle";
import BudgetPlanEditor from "./BudgetPlanEditor";
import BudgetSpendingCategories from "./BudgetSpendingCategories";
import { spendingInCycle, type BudgetSpendingEntry as SpendingEntry } from "./budgetSpendingData";
import { allocationError, scaleTargets, type PlanEditorState as Editor } from "./budgetEditorState";
import "./Budgets.css";

import MonthlyBudgetReport from "./MonthlyBudgetReport";

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function money(cents: number) {
  return currency.format(cents / 100);
}

function toCents(value: string) {
  return Math.round(Number(value) * 100);
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function totalSpent(entries: SpendingEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

function getTargets(category: Category): Target[] {
  if (category.targets) return category.targets;
  return category.subcategory
    ? [{ name: category.subcategory, cents: category.allocation }]
    : [];
}

const styles = `
  .budgets-page .budget-plan-heading,
  .budgets-page .budget-plan-actions,
  .budgets-page .budget-plan-row,
  .budgets-page .budget-plan-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .budget-plan-heading,
  .budget-plan-summary,
  .budget-plan-fields {
    margin-bottom: 24px;
  }

  .budget-plan-heading,
  .budget-plan-actions,
  .budget-plan-footer {
    flex-wrap: wrap;
  }

  .budgets-page .budget-plan-note {
    margin-top: 8px;
    color: var(--budget-muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .budget-plan-amount {
    display: block;
    margin-top: 8px;
    font-size: clamp(24px, 4vw, 32px);
    overflow-wrap: anywhere;
  }

  .budget-plan-columns {
    display: grid;
    grid-template-columns: minmax(0, 7fr) minmax(220px, 3fr);
    align-items: start;
    gap: 24px;
  }

  .budget-plan-stack { display: grid; gap: 16px; min-width: 0; }
  .budget-plan-stack .budget-report { margin-top: 0; }

  .budget-plan-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: 16px;
  }

  .budget-plan-fields label,
  .budget-plan-picker label {
    display: grid;
    gap: 8px;
  }

  .budget-plan-fields input,
  .budget-plan-table input,
  .budget-plan-picker select,
  .budget-plan-subcategories select {
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid var(--budget-border);
    border-radius: 8px;
    background: var(--budget-background);
    color: var(--budget-text);
    font: inherit;
  }

  .budget-plan-accounts { min-inline-size: 0; margin: 0 0 24px; }
  .budget-plan-accounts legend { padding: 0 6px; font-weight: 600; }
  .budget-plan-accounts label {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 40px;
  }
  .budget-plan-accounts input { accent-color: var(--budget-green); }
  .budget-plan-accounts input:disabled + span { color: var(--budget-muted); }

  .budget-plan-picker,
  .budget-plan-subcategories { display: grid; gap: 8px; }
  .budget-plan-picker label { font-size: 14px; }
  .budget-plan-subcategories { margin-top: 8px; font-weight: 400; }
  .budget-plan-subcategories select { min-height: 36px; padding: 6px 8px; }

  .budget-plan-targets {
    display: grid;
    gap: 6px;
    padding: 0;
    margin: 8px 0;
    list-style: none;
    color: var(--budget-muted);
    font-size: 13px;
  }

  .budget-plan-subcategories li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .budgets-page .budget-plan-subcategories button {
    min-height: 32px;
    padding: 4px 8px;
    font-size: 12px;
  }

  .budget-plan-table-wrap { overflow-x: auto; }
  .budget-plan-table {
    width: 100%;
    min-width: 460px;
    border-collapse: collapse;
    text-align: left;
    font-size: 14px;
  }

  .budget-plan-table :is(th, td) {
    padding: 10px 8px;
    border-bottom: 1px solid var(--budget-border);
  }
  .budget-plan-table input { min-width: 100px; }

  .budget-plan-category { padding: 12px 0; }
  .budget-plan-category + .budget-plan-category { border-top: 1px solid var(--budget-border); }
  .budget-plan-category summary { cursor: pointer; }
  .budget-plan-row { list-style: none; }
  .budget-plan-row::-webkit-details-marker { display: none; }
  .budget-plan-over { background: var(--budget-red); }

  .budget-plan-transactions { margin: 12px 0; padding-inline-start: 12px; }
  .budget-plan-transactions details { border-top: 1px solid var(--budget-border); padding: 8px 0; }
  .budget-plan-transactions ul { list-style: none; padding: 0; margin: 8px 0; }
  .budget-plan-transactions li {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
  }
  .budget-plan-transactions small { display: block; color: var(--budget-muted); }

  .budget-plan-donut {
    display: grid;
    place-items: center;
    width: 152px;
    max-width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    margin: 20px auto;
  }

  .budget-plan-donut strong {
    display: grid;
    place-items: center;
    width: 76%;
    aspect-ratio: 1;
    border-radius: inherit;
    background: var(--budget-surface);
  }

  .budget-plan-legend {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 14px;
  }

  .budget-plan-legend li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
  }

  .budget-plan-swatch { width: 10px; height: 10px; border-radius: 2px; }

  .budget-plan-footer {
    position: sticky;
    bottom: 12px;
    z-index: 1;
    margin-top: 24px;
  }

  .budget-plan-footer .budget-report-button { margin: 0; }
  .budgets-page .budget-plan-footer button:disabled { cursor: not-allowed; }
  .budgets-page .budget-plan-error { margin-top: 8px; color: var(--budget-red); }

  @media (max-width: 900px) {
    .budget-plan-columns { grid-template-columns: minmax(0, 1fr); }
  }
`;

function PercentBar({ spent, limit }: { spent: number; limit: number }) {
  const percent = limit > 0 ? Math.max(0, (spent / limit) * 100) : spent > 0 ? Infinity : 0;
  let className = "budget-progress-fill";

  if (percent > 100) {
    className += " budget-plan-over";
  } else if (percent >= 80) {
    className += " budget-progress-warning";
  }

  return (
    <div className="budget-progress" aria-hidden="true">
      <div className={className} style={{ width: `${Math.min(percent, 100)}%` }} />
    </div>
  );
}

function SpendingChart({ entries }: { entries: SpendingEntry[] }) {
  const total = totalSpent(entries);
  const groups = Array.from(new Set(entries.map(entry => entry.name)), (name, index) => ({
    id: name, name, amount: totalSpent(entries.filter(entry => entry.name === name)),
    color: ['#61d98f', '#37b84c', '#849b90', '#71b8ce', '#dba868', '#a2a4df'][index % 6],
  }));
  const positiveTotal = groups.reduce((sum, group) => sum + Math.max(0, group.amount), 0);
  const { stops } = groups.filter(group => group.amount > 0).reduce((chart, { amount, color }) => {
    const cumulative = chart.cumulative + amount;
    return {
      cumulative,
      stops: [...chart.stops, `${color} ${(chart.cumulative / positiveTotal) * 100}% ${(cumulative / positiveTotal) * 100}%`],
    };
  }, { cumulative: 0, stops: [] as string[] });

  return (
    <section className="budget-panel">
      <h3>Spending breakdown</h3>
      {total > 0 ? (
        <>
          <div
            className="budget-plan-donut"
            style={{ background: `conic-gradient(${stops.join(", ")})` }}
            aria-hidden="true"
          >
            <strong>{money(total)}</strong>
          </div>
        </>
      ) : (
        <p className="budget-plan-note">{total < 0 ? `${money(-total)} in net refunds this cycle.` : 'No net spending this cycle.'}</p>
      )}
      {groups.some(group => group.amount < 0) && total > 0 && <p className="budget-plan-note">The chart shows categories with net spending. Refunds are included in the totals below.</p>}
      {groups.length > 0 && <ul className="budget-plan-legend">
        {groups.map(({ id, name, amount, color }) => <li key={id}>
          <span className="budget-plan-swatch" style={{ background: color }} aria-hidden="true" />
          <span>{name}</span><span>{money(amount)}</span>
        </li>)}
      </ul>}
    </section>
  );
}

export default function Budgets({ userId, initialCreate = false, onConnectAccount, onEditorModeChange }: {
  userId: string; initialCreate?: boolean; onConnectAccount: () => void; onEditorModeChange?: (mode: Editor["mode"] | null) => void;
}) {
  const today = currentDay();
  const { accounts, status, loading, error, reload } = useSavedAccounts();
  const budgetAccounts = accounts.filter(account => account.currency === 'CAD' &&
    ['cash', 'chequing', 'savings', 'credit_card'].includes(account.accountType)).map(account => ({
    id: account.id, name: account.name, lastFour: account.mask,
    status: account.connectionStatus === 'connected' ? 'Connected' : 'Reconnect',
  }));
  const connectedIds = budgetAccounts.filter(account => account.status === 'Connected').map(account => account.id);
  const [plan, setPlan] = useState(() => loadBudgetPlan(userId));
  const [editor, setEditor] = useState<Editor | null>(() => initialCreate
    ? { mode: 'create', start: today, budget: '', categories: [], accountIds: [] } : null);
  const [planError, setPlanError] = useState("");

  useEffect(() => { onEditorModeChange?.(editor?.mode ?? null); }, [editor?.mode, onEditorModeChange]);

  const cycle = plan ? getCycle(plan.start) : null;
  const selectedIds = plan?.accountIds ?? connectedIds;
  const hasUnavailableAccount = selectedIds.some((id) => !connectedIds.includes(id));
  const spending = useBudgetSpending(status?.environment, selectedIds,
    cycle && !cycle.scheduled ? cycle.firstDay.toISOString().slice(0, 10) : '', today);
  // Keep saved history from accounts that need reconnection; reconnecting does not erase spending.
  const entries = cycle ? spendingInCycle(spending.entries, selectedIds.filter(id => budgetAccounts.some(account => account.id === id)),
    cycle.firstDay.toISOString().slice(0, 10), cycle.nextStart.toISOString().slice(0, 10), today, cycle.scheduled) : [];
  const spent = totalSpent(entries);
  const extraNames = [...new Set(entries.map(entry => entry.name))].filter(name => !plan?.categories.some(category => category.name.toLowerCase() === name.toLowerCase()));
  const displayCategories = [...(plan?.categories ?? []), ...extraNames.map((name, index) => ({ id: -index - 1, name, allocation: 0 }))];

  function openEditor(mode: Editor["mode"]) {
    const existing = mode === "edit" ? plan : null;

    setEditor({
      mode,
      start: existing?.start ?? today,
      budget: existing ? String(existing.budget / 100) : "",
      accountIds: existing?.accountIds ?? connectedIds,
      categories: existing?.categories.map((category) => ({
        ...category,
        allocation: String(category.allocation / 100),
        targets: getTargets(category),
      })) ?? [],
    });
    setPlanError("");
  }

  function updateEditor(changes: Partial<Editor>) {
    setEditor((current) => current ? { ...current, ...changes } : current);
    setPlanError("");
  }

  function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;

    const budget = toCents(editor.budget);
    const categories = editor.categories.map(({ id, name, allocation, targets }) => {
      const cents = toCents(allocation);
      return {
        id,
        name,
        allocation: cents,
        targets: Number.isSafeInteger(cents) && cents >= 0
          ? scaleTargets(targets ?? [], cents)
          : [],
      };
    });
    const error = allocationError(budget, categories.map(category => category.allocation));
    if (!editor.start || error || loading) {
      setPlanError(error || "Enter a valid start date and wait for your accounts to finish loading.");
      return;
    }

    const accountIds = editor.accountIds.filter((id) => connectedIds.includes(id));
    const nextPlan: Plan = { start: editor.start, budget, categories, accountIds };
    try {
      localStorage.setItem(budgetStorageKey(userId), JSON.stringify(nextPlan));
      setPlan(nextPlan);
      setEditor(null);
      setPlanError("");
    } catch {
      setPlanError("Could not save this plan in your browser.");
    }
  }

  if (editor) return <BudgetPlanEditor
    editor={editor} accounts={budgetAccounts} loading={loading} accountError={error}
    planError={planError} cycleLabel={getCycle(editor.start).label} previousPlan={plan}
    onChange={updateEditor} onSave={savePlan} onCancel={() => setEditor(null)}
    onConnectAccount={onConnectAccount} onRetry={reload} onReplace={() => openEditor("replace")}
  />;

  if (!plan) return <BudgetEmptyState onCreatePlan={() => openEditor('create')} loadError={error} onRetry={reload}><MonthlyBudgetReport plan={plan} /></BudgetEmptyState>;

  if (cycle?.scheduled) return <BudgetScheduledState plan={plan} onEdit={() => openEditor("edit")} onReplace={() => openEditor("replace")}><MonthlyBudgetReport plan={plan} /></BudgetScheduledState>;

  return (
    <div className="budgets-page">
      <style>{styles}</style>

      <header className="budget-plan-heading">
        <div>
          <h1>Your monthly budget</h1>
          <p className="budget-plan-note">Today · {dateFormat.format(parseDate(today))}</p>
        </div>
        {plan && (
          <button type="button" className="budget-report-button" onClick={() => openEditor("edit")}>
            Edit plan
          </button>
        )}
      </header>

      {loading || spending.loading ? <section className="budget-panel" role="status">Loading your budget spending…</section>
        : error || spending.error ? <section className="budget-panel" role="alert"><p>{error || spending.error}</p><button type="button" onClick={() => { reload(); spending.reload(); }}>Try again</button></section>
        : plan && cycle ? (
        <>
          <section className="budget-panel budget-plan-summary">
            <h3>{cycle.scheduled ? "Plan scheduled" : "Spending this cycle"}</h3>
            <p className="budget-plan-note">{cycle.label}</p>
            {allocationError(plan.budget, plan.categories.map(category => category.allocation)) &&
              <p className="budget-plan-error" role="status">{allocationError(plan.budget, plan.categories.map(category => category.allocation))} Open Edit plan to finish your allocations.</p>}
            {hasUnavailableAccount && (
              <p className="budget-plan-error" role="status">
                An included account is unavailable. Open Edit plan to review your selection.
              </p>
            )}
            <strong className="budget-plan-amount">{money(spent)} spent</strong>
            <p className="budget-plan-note">of {money(plan.budget)} spending budget</p>
            <PercentBar spent={spent} limit={plan.budget} />
            <p className="budget-plan-note">
              {money(Math.abs(plan.budget - spent))} {spent > plan.budget ? "over budget" : "remaining"}
              {!cycle.scheduled && ` · ${cycle.daysLeft} days until the next cycle`}
            </p>
          </section>

          <div className="budget-plan-columns">
            <div>{extraNames.length > 0 && <p className="budget-plan-note">Spending in {extraNames.join(', ')} is included in your total. Add {extraNames.length === 1 ? 'this category' : 'these categories'} in Edit plan to assign a limit.</p>}<BudgetSpendingCategories categories={displayCategories} entries={entries} accounts={accounts} /></div>

            <div className="budget-plan-stack">
              <SpendingChart entries={entries} />

              <MonthlyBudgetReport plan={plan} />
            </div>
          </div>
        </>
      ) : (
        <section className="budget-panel">
          <h3>No monthly plan yet</h3>
          <p className="budget-plan-note">Create a monthly plan to set your spending budget.</p>
          <button type="button" className="budget-report-button" onClick={() => openEditor("create")}>
            Create monthly plan
          </button>
        </section>
      )}
    </div>
  );
}
