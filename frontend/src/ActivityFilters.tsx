import { useEffect, useId, useRef, useState } from 'react';
import type { ActivityFilters as Filters } from './activityData';
import searchIcon from './assets/navigation/search.svg';
import filterIcon from './assets/navigation/budget.svg';
import chevronIcon from './assets/budget/chevron-down.svg';

type Option = { id: string; name: string; description?: string };
export type ActivityFilterMode = '' | 'spending' | 'income' | 'uncategorized';

export default function ActivityFilters({
  accounts,
  categories,
  filters,
  onChange,
  count,
  loading,
  error,
  onClear,
}: {
  accounts: Option[];
  categories: string[];
  filters: Filters;
  onChange: (next: Filters) => void;
  count: number;
  loading: boolean;
  error: boolean;
  onClear: () => void;
}) {
  const [open, setOpen] = useState<'accounts' | 'categories' | 'extra' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(null);
        trigger.current?.focus();
      }
    }
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  function toggle(key: 'accounts' | 'categories' | 'extra', element: HTMLButtonElement) {
    trigger.current = element;
    setOpen((current) => (current === key ? null : key));
  }
  function select(key: 'accounts' | 'categories', value: string) {
    const values = filters[key];
    onChange({
      ...filters,
      [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
    });
  }
  const restricted =
    filters.accounts.length > 0 ||
    filters.categories.length > 0 ||
    filters.search !== '' ||
    filters.mode !== '';
  const modes: { value: ActivityFilterMode; label: string; short: string }[] = [
    { value: '', label: 'All transactions', short: 'All' },
    { value: 'spending', label: 'Spending only', short: 'Out' },
    { value: 'income', label: 'Income only', short: 'In' },
    { value: 'uncategorized', label: 'Uncategorised', short: 'Unsorted' },
  ];
  return (
    <div ref={root} className="fcat-filter-area">
      <div className="fcat-toolbar">
        <label className="fcat-search">
          <img src={searchIcon} alt="" />
          <span className="fcat-sr-only">Search transactions</span>
          <input
            type="search"
            placeholder="Search transactions"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
          />
        </label>
        <div className="fcat-filter">
          <button
            type="button"
            aria-expanded={open === 'accounts'}
            aria-controls={id + '-accounts'}
            onClick={(event) => toggle('accounts', event.currentTarget)}
          >
            <img src={chevronIcon} alt="" />
            {filters.accounts.length
              ? `${filters.accounts.length} account${filters.accounts.length === 1 ? '' : 's'}`
              : 'All accounts'}
          </button>
          {open === 'accounts' && (
            <div
              id={id + '-accounts'}
              className="fcat-popover"
              role="group"
              aria-label="Filter accounts"
            >
              <div className="fcat-popover-title">
                <strong>Accounts</strong>
                <button onClick={() => onChange({ ...filters, accounts: [] })}>Clear</button>
              </div>
              <label className="fcat-option">
                <input
                  type="checkbox"
                  checked={!filters.accounts.length}
                  onChange={() => onChange({ ...filters, accounts: [] })}
                />
                <span>All accounts</span>
              </label>
              <div className="fcat-options">
                {accounts.map((account) => (
                  <label className="fcat-option" key={account.id}>
                    <input
                      type="checkbox"
                      checked={filters.accounts.includes(account.id)}
                      onChange={() => select('accounts', account.id)}
                    />
                    <span>
                      {account.name}
                      <small>{account.description}</small>
                    </span>
                  </label>
                ))}
              </div>
              {!accounts.length && <p>No connected accounts.</p>}
              <button
                className="fcat-done"
                onClick={() => {
                  setOpen(null);
                  trigger.current?.focus();
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
        <div className="fcat-filter">
          <button
            type="button"
            aria-expanded={open === 'categories'}
            aria-controls={id + '-categories'}
            onClick={(event) => toggle('categories', event.currentTarget)}
          >
            <img src={chevronIcon} alt="" />
            {filters.categories.length
              ? `${filters.categories.length} categor${filters.categories.length === 1 ? 'y' : 'ies'}`
              : 'All categories'}
          </button>
          {open === 'categories' && (
            <div
              id={id + '-categories'}
              className="fcat-popover"
              role="group"
              aria-label="Filter categories"
            >
              <div className="fcat-popover-title">
                <strong>Categories</strong>
                <button onClick={() => onChange({ ...filters, categories: [] })}>Clear</button>
              </div>
              <label className="fcat-option">
                <input
                  type="checkbox"
                  checked={!filters.categories.length}
                  onChange={() => onChange({ ...filters, categories: [] })}
                />
                <span>All categories</span>
              </label>
              <div className="fcat-options">
                {categories.map((category) => (
                  <label className="fcat-option" key={category}>
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(category)}
                      onChange={() => select('categories', category)}
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
              {!categories.length && <p>No categories in this period.</p>}
              <button
                className="fcat-done"
                onClick={() => {
                  setOpen(null);
                  trigger.current?.focus();
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
        <div className="fcat-filter fcat-extra">
          <button
            type="button"
            aria-expanded={open === 'extra'}
            aria-controls={id + '-extra'}
            onClick={(event) => toggle('extra', event.currentTarget)}
          >
            <img src={filterIcon} alt="" />
            Filters{filters.mode ? ' (1)' : ''}
          </button>
          {open === 'extra' && (
            <div
              id={id + '-extra'}
              className="fcat-popover"
              role="group"
              aria-label="Additional activity filters"
            >
              <div className="fcat-popover-title">
                <strong>Show activity</strong>
                <button onClick={() => onChange({ ...filters, mode: '' })}>Clear</button>
              </div>
              {modes.map((mode) => (
                <label className="fcat-option" key={mode.value}>
                  <input
                    type="radio"
                    name={id + '-mode'}
                    checked={filters.mode === mode.value}
                    onChange={() => onChange({ ...filters, mode: mode.value })}
                  />
                  <span>{mode.label}</span>
                </label>
              ))}
              <button
                className="fcat-done"
                onClick={() => {
                  setOpen(null);
                  trigger.current?.focus();
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
        {restricted && (
          <button className="fcat-clear" type="button" onClick={onClear}>
            Clear filters
          </button>
        )}
        <span className="fcat-count" role="status">
          {error
            ? 'Activity unavailable'
            : loading
              ? 'Loading…'
              : `${count} ${count === 1 ? 'transaction' : 'transactions'}`}
        </span>
      </div>
      <div className="fcat-mobile-modes" aria-label="Activity type">
        {modes.map((mode) => (
          <button
            key={mode.value}
            aria-pressed={filters.mode === mode.value}
            onClick={() => onChange({ ...filters, mode: mode.value })}
          >
            {mode.short}
          </button>
        ))}
      </div>
    </div>
  );
}
