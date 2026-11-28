import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { budgetCatalogue } from './budgetCatalogue';
import { allocationError, scaleTargets, setExpenseAmount, type DraftCategory, type PlanEditorState } from './budgetEditorState';
import type { BudgetPlan } from './budgetState';
import deleteIcon from './assets/budget/delete.svg';
import upIcon from './assets/budget/chevron-up.svg';
import downIcon from './assets/budget/chevron-down.svg';
import './BudgetPlanEditor.css';

const dollars = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const expenseDollars = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const dateFormat = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const monthFormat = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const cents = (value: string) => Math.round(Number(value) * 100);
const money = (value: number) => dollars.format(value / 100);
const date = (value: string) => new Date(`${value}T00:00:00Z`);

type Account = { id: string; name: string; lastFour: string | null; status: string };
type Props = {
  editor: PlanEditorState;
  accounts: Account[];
  loading: boolean;
  notice?: ReactNode;
  saving: boolean;
  saveBlocked: boolean;
  accountError: string;
  planError: string;
  cycleLabel: string;
  previousPlan: BudgetPlan | null;
  onChange: (changes: Partial<PlanEditorState>) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onConnectAccount: () => void;
  onRetry: () => void;
  onReplace: () => void;
};

function Modal({ title, wide = false, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLInputElement>('[data-initial-focus]')?.focus();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} className={`plan-dialog${wide ? ' plan-dialog-wide' : ''}`} aria-label={title} onCancel={onClose}>
    {children}
  </dialog>;
}

function AmountEditor({ title, value, minimum = 0, onApply, onClose }: { title: string; value: string; minimum?: number; onApply: (value: string) => void; onClose: () => void }) {
  const [amount, setAmount] = useState(value);
  const valid = amount.trim() !== '' && /^\d+(\.\d{0,2})?$/.test(amount) && Number.isSafeInteger(cents(amount)) && cents(amount) >= minimum;
  function key(value: string) {
    setAmount(current => {
      const next = value === '.' ? (current.includes('.') ? current : `${current || '0'}.`) : (current === '0' ? value : current + value);
      return /^\d*(\.\d{0,2})?$/.test(next) ? next : current;
    });
  }
  return <Modal title={title} onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); if (valid) { onApply(amount); onClose(); } }}>
      <header className="plan-dialog-heading"><h2>{title}</h2><button type="button" onClick={() => setAmount('')}>Clear</button></header>
      <div className="plan-amount-entry"><span aria-hidden="true">$</span><input data-initial-focus aria-label={`${title} in CAD`} inputMode="decimal" value={amount} placeholder="0" onChange={event => { const next = event.target.value.replace(/[$,]/g, ''); if (/^\d*(\.\d{0,2})?$/.test(next)) setAmount(next); }} /><span>CAD</span></div>
      <p className="plan-dialog-note">Enter dollars and cents. Expense changes update their category total.</p>
      <div className="plan-keypad">
        {['1','2','3','4','5','6','7','8','9','.','0'].map(value => <button type="button" key={value} onClick={() => key(value)}>{value}</button>)}
        <button type="button" aria-label="Delete last digit" onClick={() => setAmount(current => current.slice(0, -1))}>Delete</button>
      </div>
      <button type="submit" className="plan-primary plan-dialog-apply" disabled={!valid}>Apply amount</button>
      <button type="button" className="plan-dialog-cancel" onClick={onClose}>Cancel</button>
    </form>
  </Modal>;
}

function StartDateEditor({ value, onApply, onClose }: { value: string; onApply: (value: string) => void; onClose: () => void }) {
  const [month, setMonth] = useState(() => { const selected = date(value); return new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1)); });
  const year = month.getUTCFullYear();
  const index = month.getUTCMonth();
  const days = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const today = new Date();
  return <Modal title="Choose a start date" onClose={onClose}>
    <h2>Choose a start date</h2>
    <div className="plan-calendar-heading"><button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(year, index - 1, 1)))}>‹</button><strong>{monthFormat.format(month)}</strong><button type="button" aria-label="Next month" onClick={() => setMonth(new Date(Date.UTC(year, index + 1, 1)))}>›</button></div>
    <p className="plan-dialog-note">Each plan runs for a full month. Choose the day your plan starts.</p>
    <div className="plan-calendar">
      {['Su','Mo','Tu','We','Th','Fr','Sa'].map(day => <span className="plan-weekday" key={day}>{day}</span>)}
      {Array.from({ length: month.getUTCDay() }, (_, i) => <span key={`blank-${i}`} />)}
      {Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const iso = `${year}-${String(index + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = today.getFullYear() === year && today.getMonth() === index && today.getDate() === day;
        return <button type="button" key={iso} className={iso === value ? 'plan-day-selected' : isToday ? 'plan-day-today' : ''} aria-label={dateFormat.format(date(iso))} aria-pressed={iso === value} onClick={() => { onApply(iso); onClose(); }}>{day}</button>;
      })}
    </div>
    <button type="button" className="plan-dialog-cancel" onClick={onClose}>Cancel</button>
  </Modal>;
}

function Catalogue({ categories, onChange, onClose, focusCategory }: { categories: DraftCategory[]; onChange: (categories: DraftCategory[]) => void; onClose: () => void; focusCategory?: string }) {
  const [expanded, setExpanded] = useState<string[]>(focusCategory ? [focusCategory] : []);
  function toggleCategory(name: string, selected: boolean) {
    onChange(selected ? [...categories, { id: Math.max(0, ...categories.map(c => c.id)) + 1, name, allocation: '0', targets: [] }] : categories.filter(c => c.name !== name));
  }
  function toggleExpense(name: string, expense: string, selected: boolean) {
    const current = categories.find(c => c.name === name);
    if (!current) {
      onChange([...categories, { id: Math.max(0, ...categories.map(c => c.id)) + 1, name, allocation: '0', targets: [{ name: expense, cents: 0 }] }]);
      return;
    }
    const targets = selected ? [...(current.targets ?? []), { name: expense, cents: current.targets?.length ? 0 : cents(current.allocation) }] : (current.targets ?? []).filter(target => target.name !== expense);
    onChange(categories.map(c => c.id === current.id ? { ...c, targets, allocation: String(targets.reduce((sum, target) => sum + target.cents, 0) / 100) } : c));
  }
  return <Modal title="Choose categories & expenses" wide onClose={onClose}>
    <header className="plan-catalogue-heading"><div><h2>Choose categories &amp; expenses</h2><p className="plan-dialog-note">Build a plan that fits your life, with or without linked accounts.</p></div><button type="button" onClick={onClose}>Close</button></header>
    <div className="plan-catalogue-intro"><span>Select a category, or expand it to choose expenses.</span><strong>Browse all categories</strong></div>
    <div className="plan-catalogue-list">
      {budgetCatalogue.map(category => {
        const selected = categories.find(c => c.name === category.name);
        const open = expanded.includes(category.name);
        return <section className="plan-catalogue-category" key={category.name}>
          <header><label><input type="checkbox" checked={!!selected} onChange={event => toggleCategory(category.name, event.currentTarget.checked)} /><span><strong>{category.name}</strong><small>{category.description}</small></span></label><button type="button" className="plan-icon-button" aria-label={`${open ? 'Collapse' : 'Expand'} ${category.name} expenses`} aria-expanded={open} onClick={() => setExpanded(current => open ? current.filter(name => name !== category.name) : [...current, category.name])}><img src={open ? upIcon : downIcon} alt="" /></button></header>
          {open && <div className="plan-catalogue-expenses">{[...new Set([...category.expenses, 'Other spending'])].map(expense => <label key={expense}><input type="checkbox" checked={!!selected?.targets?.some(t => t.name === expense)} onChange={event => toggleExpense(category.name, expense, event.currentTarget.checked)} /><span>{expense}</span></label>)}</div>}
        </section>;
      })}
    </div>
    <footer className="plan-catalogue-footer"><div><p>Selections are added to this draft. Save the plan to keep them.</p><p className="plan-dialog-note">Savings, transfers and credit card payments stay outside spending categories.</p></div><button type="button" className="plan-primary" onClick={onClose}>Done</button></footer>
  </Modal>;
}

export default function BudgetPlanEditor({ editor, accounts, loading, notice, saving, saveBlocked, accountError, planError, cycleLabel, previousPlan, onChange, onSave, onCancel, onConnectAccount, onRetry, onReplace }: Props) {
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [overlay, setOverlay] = useState<'date' | 'catalogue' | null>(null);
  const [focusCategory, setFocusCategory] = useState<string>();
  const [amountEdit, setAmountEdit] = useState<{ title: string; value: string; categoryId?: number; expense?: string } | null>(null);
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const budget = cents(editor.budget) || 0;
  const allocated = editor.categories.reduce((sum, category) => sum + (cents(category.allocation) || 0), 0);
  const left = budget - allocated;
  const validationError = allocationError(cents(editor.budget), editor.categories.map(category => cents(category.allocation)));
  const saveError = planError || validationError;
  const disabled = !!validationError || loading || saving || saveBlocked || !!accountError;
  const selectedDate = date(editor.start);
  const titles = { create: 'Create your monthly plan', edit: 'Edit your monthly plan', replace: 'Create a replacement plan' };
  function updateCategory(category: DraftCategory) { onChange({ categories: editor.categories.map(c => c.id === category.id ? category : c) }); }
  function applyAmount(value: string) {
    if (amountEdit?.categoryId === undefined) { onChange({ budget: value }); return; }
    const category = editor.categories.find(c => c.id === amountEdit.categoryId);
    if (!category) return;
    updateCategory(amountEdit.expense ? setExpenseAmount(category, amountEdit.expense, cents(value)) : { ...category, allocation: value, targets: scaleTargets(category.targets ?? [], cents(value)) });
  }
  function openCatalogue(name?: string) { setFocusCategory(name); setOverlay('catalogue'); }
  return <div className="budgets-page plan-editor" inert={saving} aria-busy={saving}>
    <header className="plan-editor-heading"><div><button type="button" className="plan-back" onClick={onCancel}>← Back to Budget</button><h1>{titles[editor.mode]}</h1><p>Choose a spending limit and assign it to your categories.</p></div><span className="plan-month">{monthFormat.format(selectedDate)}</span></header>
    {notice}
    <form id="budget-plan-form" onSubmit={event => {
      if (editor.mode === 'replace') {
        event.preventDefault();
        if (!disabled) setConfirmReplacement(true);
      } else onSave(event);
    }}>
      <div className="plan-editor-columns">
        <div className="plan-editor-stack">
          <button type="button" className="plan-panel plan-start-card" onClick={() => setOverlay('date')}><span>Plan start date · Change</span><strong>{dateFormat.format(selectedDate)}</strong><small>{cycleLabel}</small></button>
          <section className="plan-panel plan-accounts-card" aria-labelledby="plan-account-title">
            <h2 id="plan-account-title">Accounts included in this budget</h2><p>Only posted purchases and refunds from selected accounts count. Transfers and credit-card payments are excluded.</p>
            {loading ? <p role="status">Loading your accounts…</p> : accountError ? <p role="alert">{accountError} <button type="button" onClick={onRetry}>Try again</button></p> : accounts.length ? <div className="plan-account-options">{accounts.map(account => <label key={account.id}><input type="checkbox" checked={editor.accountIds.includes(account.id)} disabled={account.status !== 'Connected' && !editor.accountIds.includes(account.id)} onChange={event => onChange({ accountIds: event.currentTarget.checked ? [...editor.accountIds, account.id] : editor.accountIds.filter(id => id !== account.id) })} /><span>{account.name}{account.lastFour && ` · •${account.lastFour}`}<small>{account.status === 'Connected' ? 'Connected' : 'Reconnection needed'}</small></span></label>)}</div> : <div className="plan-no-accounts"><strong>No accounts connected</strong><p>Connect an account to choose which spending counts toward this plan.</p><button type="button" className="plan-text-button" onClick={onConnectAccount}>Connect an account</button></div>}
            <p>Your spending limit is independent of income. You can plan before connecting an account.</p>
          </section>
          <section className="plan-panel plan-budget-card"><div><h2>Budget amount</h2><p>Your spending limit for this month. This does not change or estimate your income.</p></div><button type="button" className="plan-amount-button" aria-label={`Change budget amount, ${money(budget)}`} onClick={() => setAmountEdit({ title: 'Budget amount', value: editor.budget })}>{money(budget)}</button></section>
          <section className="plan-categories" aria-labelledby="plan-categories-title">
            <header className="plan-section-heading"><div><h2 id="plan-categories-title">Standard categories</h2><p>Expand a category to manage its expenses.</p></div><button type="button" className="plan-text-button" disabled={!previousPlan} aria-describedby="plan-copy-note" title={!previousPlan ? 'No saved plan is available to copy' : 'Copy the spending limit, categories and expense amounts from your saved plan'} onClick={() => previousPlan && onChange({ budget: String(previousPlan.budget / 100), categories: previousPlan.categories.map(c => ({ ...c, allocation: String(c.allocation / 100), targets: c.targets ?? (c.subcategory ? [{ name: c.subcategory, cents: c.allocation }] : []) })) })}>Copy saved plan</button></header><p id="plan-copy-note" className="plan-copy-note">{previousPlan ? 'Copies the spending limit, categories and expense amounts from your saved plan into this draft.' : 'Save your first plan to reuse its spending limit, categories and expense amounts.'}</p>
            {editor.categories.length === 0 && <p className="plan-categories-empty">Add categories to start assigning your budget.</p>}
            {editor.categories.map(category => {
              const open = !collapsed.includes(category.id);
              return <section key={category.id} className="plan-category-card">
                <header><button type="button" className="plan-category-name" aria-expanded={open} aria-controls={`plan-expenses-${category.id}`} onClick={() => setCollapsed(current => open ? [...current, category.id] : current.filter(id => id !== category.id))}><strong>{category.name}</strong><small>Monthly budget</small></button><button type="button" className="plan-amount-button" aria-label={`Change ${category.name} allocation, ${money(cents(category.allocation))}`} onClick={() => setAmountEdit({ title: category.name, value: category.allocation, categoryId: category.id })}>{money(cents(category.allocation))}</button><button type="button" className="plan-icon-button" aria-label={`Remove ${category.name}`} onClick={() => onChange({ categories: editor.categories.filter(c => c.id !== category.id) })}><img src={deleteIcon} alt="" /></button><button type="button" className="plan-icon-button" aria-label={`${open ? 'Collapse' : 'Expand'} ${category.name}`} aria-expanded={open} aria-controls={`plan-expenses-${category.id}`} onClick={() => setCollapsed(current => open ? [...current, category.id] : current.filter(id => id !== category.id))}><img src={open ? upIcon : downIcon} alt="" /></button></header>
                {open && <div className="plan-expenses" id={`plan-expenses-${category.id}`}>{category.targets?.map(target => <div className="plan-expense-row" key={target.name}><span>{target.name}</span><button type="button" className="plan-amount-button" aria-label={`Change ${target.name} amount, ${expenseDollars.format(target.cents / 100)}`} onClick={() => setAmountEdit({ title: target.name, value: String(target.cents / 100), categoryId: category.id, expense: target.name })}>{expenseDollars.format(target.cents / 100)}</button><button type="button" className="plan-icon-button" aria-label={`Remove ${target.name} from ${category.name}`} onClick={() => { const targets = (category.targets ?? []).filter(t => t.name !== target.name); updateCategory({ ...category, targets, allocation: String(targets.reduce((sum, t) => sum + t.cents, 0) / 100) }); }}><img src={deleteIcon} alt="" /></button></div>)}<button type="button" className="plan-text-button plan-add-expense" onClick={() => openCatalogue(category.name)}>+ Add expense</button></div>}
              </section>;
            })}
            <button type="button" className="plan-add-category" onClick={() => openCatalogue()}>+ Add category</button>
            <div className="plan-total"><small>Your categories</small><span>Total planned <strong>{money(allocated)}</strong></span></div>
          </section>
        </div>
        <aside className="plan-editor-aside"><section className={`plan-panel plan-glance${left < 0 ? ' plan-overallocated' : ''}`} aria-labelledby="plan-glance-title"><h2 id="plan-glance-title">Your plan at a glance</h2><div className="plan-unassigned" aria-live="polite"><span>LEFT TO ASSIGN</span><strong>{money(left)}</strong><p>{left < 0 ? `Reduce allocations by ${money(-left)}.` : budget <= 0 ? 'Set your spending limit to get started.' : left === 0 ? 'Every dollar is assigned.' : 'Assign this amount to your categories.'}</p></div><div className="plan-glance-totals"><p><span>Budget amount</span><strong>{money(budget)}</strong></p><p><span>Planned spending</span><strong>{money(allocated)}</strong></p></div></section><p className="plan-guidance">Category totals include their expenses. Add categories to make this plan your own.</p>{editor.mode === 'edit' && <button type="button" onClick={onReplace}>Create a replacement plan</button>}</aside>
      </div>
      <footer className="plan-panel plan-save-footer"><div><p>Changes apply to {monthFormat.format(selectedDate)}</p><small>Your recorded transactions stay as they are.</small>{saveError && <p id="plan-save-error" className="plan-error" role="alert">{saveError}</p>}</div><button type="button" onClick={onCancel}>Cancel</button><button type="submit" className="plan-primary" disabled={disabled} aria-describedby={saveError ? 'plan-save-error' : undefined}>{saving ? 'Saving…' : editor.mode === 'edit' ? 'Save changes' : editor.mode === 'replace' ? 'Review replacement' : 'Create budget'}</button></footer>
    </form>
    {confirmReplacement && <Modal title="Replace your saved plan?" onClose={() => setConfirmReplacement(false)}>
      <form className="plan-replacement-confirmation" onSubmit={event => { onSave(event); setConfirmReplacement(false); }}>
        <h2>Replace your saved plan?</h2>
        <p>This replaces your saved budget with the spending limit, categories, expense amounts and accounts in this draft.</p>
        <dl>
          {previousPlan && <><dt>Saved budget</dt><dd>{money(previousPlan.budget)} · starts {dateFormat.format(date(previousPlan.start))}</dd></>}
          <dt>Replacement budget</dt><dd>{money(budget)} · starts {dateFormat.format(selectedDate)}</dd>
          <dt>Cycle</dt><dd>{cycleLabel}</dd>
        </dl>
        <button type="button" data-initial-focus className="plan-dialog-cancel" onClick={() => setConfirmReplacement(false)}>Keep editing</button>
        <button type="submit" className="plan-primary plan-dialog-apply" disabled={disabled}>Replace saved plan</button>
      </form>
    </Modal>}
    {overlay === 'date' && <StartDateEditor value={editor.start} onApply={start => onChange({ start })} onClose={() => setOverlay(null)} />}
    {overlay === 'catalogue' && <Catalogue categories={editor.categories} onChange={categories => onChange({ categories })} focusCategory={focusCategory} onClose={() => setOverlay(null)} />}
    {amountEdit && <AmountEditor title={amountEdit.title} value={amountEdit.value} minimum={amountEdit.categoryId === undefined ? 1 : 0} onApply={applyAmount} onClose={() => setAmountEdit(null)} />}
  </div>;
}
