import { Fragment, useState } from 'react';
import type { BudgetCategory } from './budgetState';
import { categorySpending, remainingTone, type BudgetSpendingEntry } from './budgetSpendingData';
import homeIcon from './assets/budget/category-home.svg';
import foodIcon from './assets/budget/category-food.svg';
import transportIcon from './assets/budget/category-transportation.svg';
import shoppingIcon from './assets/budget/category-shopping.svg';
import subscriptionsIcon from './assets/budget/category-subscriptions.svg';
import budgetIcon from './assets/navigation/budget.svg';
import downIcon from './assets/budget/chevron-down.svg';
import upIcon from './assets/budget/chevron-up.svg';
import './BudgetSpendingCategories.css';

const currency = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const money = (cents: number) => currency.format(cents / 100);
const dateFormat = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const icons: Record<string, string> = {
  'home & bills': homeIcon, 'food & drink': foodIcon, groceries: foodIcon,
  transportation: transportIcon, shopping: shoppingIcon, subscriptions: subscriptionsIcon,
};

function Remaining({ allocated, spent, showLabel = false }: { allocated: number | null; spent: number; showLabel?: boolean }) {
  if (allocated === null) return <span className="budget-remaining-neutral" aria-label="No subcategory allocation">—</span>;
  const value = allocated - spent;
  const tone = remainingTone(allocated, spent);
  return <span className={`budget-remaining budget-remaining-${tone}`} title={value < 0 ? `${money(-value)} over budget` : `${money(value)} remaining`}>
    {money(showLabel && value < 0 ? -value : value)}
    {showLabel ? (value < 0 ? ' over budget' : ' remaining') :
      <span className="budget-category-sr-only">{value < 0 ? ' over budget' : value === 0 && allocated > 0 ? ' — allocation used up' : ' remaining'}</span>}
  </span>;
}

function Category({ category, entries, accounts }: { category: BudgetCategory; entries: BudgetSpendingEntry[]; accounts: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [expandedExpenses, setExpandedExpenses] = useState<string[]>([]);
  const { spent, rows } = categorySpending(category, entries);
  const percent = category.allocation > 0 ? Math.min(100, Math.max(0, spent / category.allocation * 100)) : spent > 0 ? 100 : 0;
  const tone = remainingTone(category.allocation, spent);
  const detailsId = `budget-category-details-${category.id}`;
  const categoryIcon = icons[category.name.trim().toLowerCase()] ?? budgetIcon;

  return <article className="budget-spending-category">
    <button type="button" className="budget-category-toggle" onClick={() => setOpen(current => !current)} aria-expanded={open} aria-controls={detailsId}>
      <span className="budget-category-symbol"><img src={categoryIcon} alt="" /></span>
      <span className="budget-category-overview">
        <span className="budget-category-headline">
          <span>{category.name}</span>
          <span className="budget-category-allocated">{money(category.allocation)} allocated</span>
        </span>
        <span className="budget-category-metrics">
          <span>{money(spent)} spent</span>
          <Remaining allocated={category.allocation} spent={spent} showLabel />
        </span>
        <span className="budget-category-progress" aria-hidden="true"><span className={`budget-category-fill budget-category-fill-${tone}`} style={{ width: `${percent}%` }} /></span></span>
      <img className="budget-category-chevron" src={open ? upIcon : downIcon} alt="" />
    </button>
    {open && <div className="budget-category-breakdown" id={detailsId}>
      <div className="budget-category-table-scroll" tabIndex={0} role="region" aria-label={`${category.name} subcategory breakdown`}>
        <table className="budget-category-table">
          <caption className="budget-category-sr-only">{category.name}: budgeted limits, actual expenses and remaining amounts in CAD.</caption>
          <colgroup><col className="budget-category-name-column" /><col /><col /><col /></colgroup>
          <thead><tr><th scope="col">Subcategory</th><th scope="col">Budgeted limit</th><th scope="col">Actual expense</th><th scope="col">Remaining</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td className="budget-category-empty" colSpan={4}>No subcategories assigned. This category’s total is tracked below.</td></tr>}
            {rows.map((row, index) => {
              const expanded = expandedExpenses.includes(row.name);
              const rowId = `${detailsId}-expense-${index}`;
              return <Fragment key={row.name}>
                <tr><th scope="row"><button type="button" className="budget-expense-toggle" aria-expanded={expanded} aria-controls={rowId} onClick={() => setExpandedExpenses(current => expanded ? current.filter(name => name !== row.name) : [...current, row.name])}><span>{row.name}</span><img src={expanded ? upIcon : downIcon} alt="" /></button></th><td>{row.allocated === null ? '—' : money(row.allocated)}</td><td className="budget-category-actual">{money(row.spent)}</td><td><Remaining allocated={row.allocated} spent={row.spent} /></td></tr>
                {expanded && <tr className="budget-expense-detail"><td colSpan={4}><div className="budget-expense-transactions" id={rowId}>
                  <p className="budget-expense-caption">Transactions for {row.name}</p>
                  {row.transactions.length === 0 ? <p className="budget-category-empty">No matching transactions this cycle.</p> : <ul>{row.transactions.map(entry => <li key={entry.id}><div><strong>{entry.merchant}</strong><small>{dateFormat.format(new Date(`${entry.date}T00:00:00Z`))}{accounts.find(account => account.id === entry.accountId)?.name && ` · ${accounts.find(account => account.id === entry.accountId)?.name}`}</small></div><span>{entry.amount < 0 ? '+' : '−'}{money(Math.abs(entry.amount))}</span></li>)}</ul>}
                </div></td></tr>}
              </Fragment>;
            })}
          </tbody>
          <tfoot><tr><th scope="row">Category total</th><td>{money(category.allocation)}</td><td className="budget-category-actual">{money(spent)}</td><td><Remaining allocated={category.allocation} spent={spent} /></td></tr></tfoot>
        </table>
      </div>
    </div>}
  </article>;
}

export default function BudgetSpendingCategories({ categories, entries, accounts }: { categories: BudgetCategory[]; entries: BudgetSpendingEntry[]; accounts: { id: string; name: string }[] }) {
  return <section className="budget-panel budget-category-panel" aria-labelledby="budget-category-panel-title">
    <header className="budget-category-panel-heading"><h3 id="budget-category-panel-title">Spending by category</h3><span>Your categories</span></header>
    {categories.length === 0 ? <p className="budget-category-panel-empty">No categories assigned. Open Edit plan to add one.</p> : categories.map(category => <Category key={category.id} category={category} entries={entries} accounts={accounts} />)}
  </section>;
}
