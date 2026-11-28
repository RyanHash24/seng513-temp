import { useEffect, useRef, useState } from 'react';
import activityIcon from './assets/navigation/activity.svg';
import groceriesIcon from './assets/overview/groceries.svg';
import transportIcon from './assets/overview/transport.svg';
import ActivityFilters from './ActivityFilters';
import type { ActivityTransaction, ActivityFilters as Filters } from './activityData';
import calendarIcon from './assets/overview/calendar.svg';
import { useSavedAccounts } from './useSavedAccounts';
import { useActivityTransactions } from './useActivityTransactions';
import {
  activityAccountLabel,
  activityAmount,
  activityDate,
  calendarMonth,
  currentMonth,
  filterActivity,
} from './activityData';
import './Activity.css';
import SyncBankButton from './SyncBankButton';

function ImportedActivity({
  userId,
  onViewAccounts,
}: {
  userId: string;
  onViewAccounts: () => void;
}) {
  const saved = useSavedAccounts();
  const [month, setMonth] = useState(currentMonth);
  const period = calendarMonth(month);
  const feed = useActivityTransactions(userId, saved.status, period);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [restrictions, setRestrictions] = useState<Omit<Filters, 'start' | 'end'>>({
    accounts: [],
    categories: [],
    search: '',
    mode: '',
  });
  const filters = { ...restrictions, ...period };
  const transactions = filterActivity(feed.transactions, saved.accounts, filters);
  const selected = transactions.find((transaction) => transaction.id === selectedId);
  const loading = saved.loading || feed.loading;
  const error = saved.error || feed.error;
  const details = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    details.current?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 700px)').matches) {
      details.current?.scrollIntoView({ block: 'start' });
    }
  }, [selectedId]);
  const categoryOptions = [
    ...new Set([
      ...feed.transactions.map((transaction) => transaction.category),
      ...restrictions.categories,
    ]),
  ].sort();
  const accountOptions = new Map(
    saved.accounts.map((account) => [
      account.id,
      {
        id: account.id,
        name: account.name + (account.mask ? ' •' + account.mask : ''),
        description: account.institution,
      },
    ]),
  );
  for (const transaction of feed.transactions) {
    if (!accountOptions.has(transaction.accountId))
      accountOptions.set(transaction.accountId, {
        id: transaction.accountId,
        name: transaction.accountName,
        description: transaction.institution,
      });
  }
  function clearFilters() {
    setRestrictions({ accounts: [], categories: [], search: '', mode: '' });
  }
  function transactionIcon(transaction: ActivityTransaction) {
    if (/food|grocer|dining/i.test(transaction.category)) return groceriesIcon;
    if (/transport|travel/i.test(transaction.category)) return transportIcon;
    return activityIcon;
  }
  const byDate = new Map<string, typeof transactions>();
  for (const transaction of transactions) {
    const group = byDate.get(transaction.date) || [];
    group.push(transaction);
    byDate.set(transaction.date, group);
  }
  function reload() {
    saved.reload();
    feed.reload();
  }
  const syncConnections = [
    ...new Map(
      saved.accounts
        .filter((account) => account.accountType !== 'investment')
        .map((account) => [account.connectionId, account.institution]),
    ).entries(),
  ];
  return (
    <div className="fc-activity">
      <header className="fcat-heading">
        <div>
          <h1>Your activity</h1>
          <p>Imported transactions from your connected accounts.</p>
        </div>
        <label className="fcat-period">
          <img src={calendarIcon} alt="" />
          <span className="fcat-sr-only">Activity month</span>
          <input
            aria-label="Activity month"
            type="month"
            min="0001-01"
            max="9999-12"
            value={month}
            onInput={(event) => {
              if (
                event.currentTarget.validity.valid &&
                /^\d{4}-\d{2}$/.test(event.currentTarget.value)
              )
                setMonth(event.currentTarget.value);
            }}
          />
        </label>
      </header>
      {saved.status?.configured && syncConnections.length > 0 && (
        <details className="fcat-sync-accounts">
          <summary>Sync accounts</summary>
          <p>Import available bank transactions using your existing connections.</p>
          {syncConnections.map(([id, institution]) => (
            <div className="fcat-sync-bank" key={id}>
              <strong>{institution}</strong>
              <SyncBankButton
                connectionId={id}
                environment={saved.status!.environment}
                onSynced={reload}
              />
            </div>
          ))}
        </details>
      )}
      <ActivityFilters
        accounts={[...accountOptions.values()]}
        categories={categoryOptions}
        filters={filters}
        onChange={({ accounts, categories, search, mode }) =>
          setRestrictions({ accounts, categories, search, mode })
        }
        onClear={clearFilters}
        count={transactions.length}
        loading={loading && !error}
        error={!!error}
      />
      <div className={'fcat-layout' + (selected ? ' fcat-layout-with-details' : '')}>
        <section
          className="fcat-card"
          aria-labelledby="activity-list-title"
          aria-busy={loading && !error}
        >
          <header className="fcat-card-header">
            <h2 id="activity-list-title">Transactions</h2>
            <div className="fcat-refresh">
              {feed.loadedAt && !loading && !error && (
                <span>
                  Loaded{' '}
                  {new Date(feed.loadedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              )}
              <button type="button" onClick={reload} disabled={loading && !error}>
                Refresh
              </button>
            </div>
          </header>
          {error ? (
            <div className="fcat-message" role="alert">
              <h3>Unable to load activity</h3>
              <p>{error}</p>
              <button onClick={reload}>Retry</button>
            </div>
          ) : loading ? (
            <p className="fcat-message" role="status">
              Loading your imported transactions…
            </p>
          ) : !feed.transactions.length ? (
            <div className="fcat-message">
              <h3>No transactions in this period</h3>
              <p>
                {saved.accounts.length
                  ? 'Use Sync accounts above to import available bank history for this period.'
                  : 'Connect an account to import your bank history.'}
              </p>
              <button onClick={onViewAccounts}>
                {saved.accounts.length ? 'View accounts' : 'Connect an account'}
              </button>
            </div>
          ) : !transactions.length ? (
            <div className="fcat-message">
              <h3>No matching transactions</h3>
              <p>Try another search or clear your filters.</p>
              <button onClick={clearFilters}>Clear filters</button>
            </div>
          ) : (
            <div className="fcat-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Merchant</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th className="fcat-amount">Amount</th>
                  </tr>
                </thead>
                {[...byDate].map(([date, group]) => (
                  <tbody key={date}>
                    <tr className="fcat-date-row">
                      <th colSpan={4}>
                        <time dateTime={date}>{activityDate(date)}</time>
                      </th>
                    </tr>
                    {group.map((transaction) => (
                      <tr
                        key={transaction.id}
                        onClick={(event) => {
                          opener.current = event.currentTarget.querySelector('button');
                          setSelectedId(transaction.id);
                        }}
                        className={
                          selectedId === transaction.id ? 'fcat-row fcat-row-selected' : 'fcat-row'
                        }
                      >
                        <td>
                          <button
                            className="fcat-merchant"
                            aria-pressed={selectedId === transaction.id}
                            aria-controls="activity-details"
                          >
                            <span className="fcat-selection" aria-hidden="true" />
                            <span className="fcat-transaction-icon">
                              <img src={transactionIcon(transaction)} alt="" />
                            </span>
                            <span>{transaction.merchantName || transaction.description}</span>
                          </button>
                        </td>
                        <td className="fcat-category-cell">{transaction.category}</td>
                        <td className="fcat-account-cell">
                          {activityAccountLabel(transaction, saved.accounts)}
                        </td>
                        <td
                          className={
                            'fcat-amount' + (Number(transaction.amount) > 0 ? ' fcat-positive' : '')
                          }
                        >
                          {activityAmount(transaction)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
          {!loading && !error && (
            <footer className="fcat-table-footer">
              <span>
                {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
              </span>
              <span>
                {activityDate(period.start)} – {activityDate(period.end)}
              </span>
            </footer>
          )}
        </section>
        {selected && !loading && !error && (
          <aside
            ref={details}
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setSelectedId(null);
                opener.current?.focus();
              }
            }}
            id="activity-details"
            className="fcat-card fcat-details"
            aria-labelledby="activity-detail-title"
          >
            <header className="fcat-card-header">
              <h2 id="activity-detail-title">Transaction details</h2>
              <button
                aria-label="Close transaction details"
                onClick={() => {
                  setSelectedId(null);
                  opener.current?.focus();
                }}
              >
                ×
              </button>
            </header>
            <div className="fcat-detail-merchant">
              <span className="fcat-transaction-icon">
                <img src={transactionIcon(selected)} alt="" />
              </span>
              <div>
                <strong>{selected.merchantName || selected.description}</strong>
                <p>{activityDate(selected.date)}</p>
              </div>
            </div>
            <strong
              className={
                'fcat-detail-amount' + (Number(selected.amount) > 0 ? ' fcat-positive' : '')
              }
            >
              {activityAmount(selected)}
            </strong>
            <span className="fcat-badge">Imported</span>
            <dl>
              <div>
                <dt>Account</dt>
                <dd>{activityAccountLabel(selected, saved.accounts)}</dd>
              </div>
              <div>
                <dt>Institution</dt>
                <dd>{selected.institution}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{selected.kind}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{selected.status}</dd>
              </div>
            </dl>
            <label className="fcat-category-editor">
              Category
              <select disabled aria-describedby="activity-save-note" value={selected.category}>
                <option>{selected.category}</option>
              </select>
            </label>
            <button className="fcat-save-button" disabled aria-describedby="activity-save-note">
              Save changes
            </button>
            <p id="activity-save-note" className="fcat-save-note">
              Category saving is not available yet. The imported category is shown above.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function Transactions({
  userId,
  onViewAccounts,
}: {
  userId: string;
  hasLinkedAccounts: boolean;
  onViewAccounts: () => void;
}) {
  return <ImportedActivity key={userId} userId={userId} onViewAccounts={onViewAccounts} />;
}
