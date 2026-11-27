import { useEffect, useState } from 'react';
import type { LinkedAccount, PlaidStatus } from './plaid';
import { plaidRequest } from './plaid';
import { accountGroup, currentBalance, formatAccountMoney } from './linkedAccountData';
import institutionIcon from './assets/navigation/account-institution.svg';
import institutionDarkIcon from './assets/navigation/account-institution-dark.svg';
import './AccountDetails.css';

type Cursor = { date: string; id: string };
type HistoryEntry = {
  id: string; accountId: string; description: string; date: string;
  amount: string | null; currency: string | null; category?: string; status?: string; kind?: string;
  type?: string; subtype?: string | null; ticker?: string | null; unofficialCurrency?: string | null;
};

function updatedAt(value: string | null) {
  if (!value) return 'Update time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Update time unavailable' : `Updated ${new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(date)}`;
}

function dayLabel(value: string) {
  return new Intl.DateTimeFormat('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

function amountLabel(entry: HistoryEntry) {
  if (entry.amount === null) return 'Unavailable';
  if (!entry.currency) return `${entry.amount} ${entry.unofficialCurrency || ''}`.trim();
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: entry.currency,
    currencyDisplay: 'code', signDisplay: 'exceptZero' }).format(Number(entry.amount));
}

function AccountHistory({ account, status }: { account: LinkedAccount; status: PlaidStatus | null }) {
  const [data, setData] = useState<{ entries: HistoryEntry[]; next: Cursor | null; loading: boolean; error: string }>({
    entries: [], next: null, loading: true, error: '',
  });
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(0);
  const investment = account.accountType === 'investment';
  useEffect(() => {
    if (!status?.configured) return;
    const controller = new AbortController();
    async function load() {
      setData(previous => ({ ...previous, loading: true, error: '' }));
      try {
        const query = new URLSearchParams({ accountId: account.id,
          ...(cursor ? { beforeDate: cursor.date, beforeId: cursor.id } : {}) });
        const result = await plaidRequest<{ transactions: HistoryEntry[]; nextCursor: Cursor | null }>(
          `${investment ? 'investments/transactions' : 'transactions'}?${query}`, status!.environment,
          { signal: controller.signal });
        if (!controller.signal.aborted) setData({ entries: result.transactions, next: result.nextCursor, loading: false, error: '' });
      } catch (cause) {
        if (!controller.signal.aborted) setData(previous => ({ ...previous, loading: false,
          error: cause instanceof Error ? cause.message : 'Unable to load this account’s transactions.' }));
      }
    }
    void load();
    return () => controller.abort();
  }, [account.id, investment, cursor, revision, status]);

  const entries = expanded ? data.entries : data.entries.slice(0, 3);
  const dates = [...new Set(entries.map(entry => entry.date))];
  return <section id="account-transactions-panel" role="tabpanel" aria-labelledby="account-transactions-tab" className="fca-account-history" aria-busy={data.loading}>
    <div className="fca-history-heading">
      <p className="fca-muted">{investment ? 'Investment activity' : 'Imported transactions'} · Amounts shown in their original currency</p>
      <button type="button" className="fca-history-button" disabled={data.loading} onClick={() => { setCursor(null); setRevision(value => value + 1); }}>
        {data.loading ? 'Loading…' : 'Refresh history'}
      </button>
    </div>
    {investment && <p className="fca-muted fca-note">Trades, dividends and transfers are shown separately from budget spending.</p>}
    {data.error && <div role="alert" className="fca-history-message"><p>{data.error}</p>
      <button className="fca-history-button" type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {data.loading && <p role="status" className="fca-muted fca-note">Loading this account’s {investment ? 'investment activity' : 'transactions'}…</p>}
    {!data.loading && !data.error && data.entries.length === 0 && <div className="fca-card fca-history-message">
      <h2>No {investment ? 'investment activity' : 'transactions'} imported yet</h2>
      <p className="fca-muted fca-note">There are no saved records for this account on this page. New history will appear after this connection is synced.</p>
    </div>}
    {!data.loading && !data.error && entries.length > 0 && <div className="fca-history-list">
      {dates.map(date => <section key={date} aria-label={dayLabel(date)}>
        <h2 className="fca-history-date">{dayLabel(date)}</h2>
        <ul>{entries.filter(entry => entry.date === date).map(entry => <li className="fca-history-row" key={entry.id}>
          <div><strong>{entry.description}</strong>
            <p className="fca-muted">{investment ? [entry.subtype || entry.type, entry.ticker].filter(Boolean).join(' · ').replaceAll('_', ' ')
              : entry.category || 'Uncategorized'}{entry.status === 'pending' ? ' · Pending' : ''}{entry.kind === 'transfer' ? ' · Transfer' : ''}</p>
          </div>
          <strong className={Number(entry.amount) > 0 ? 'fca-history-income' : 'fca-history-amount'}>{amountLabel(entry)}</strong>
        </li>)}</ul>
      </section>)}
    </div>}
    <div className="fca-history-actions">
      {!expanded && data.entries.length > 3 && <button type="button" className="fca-history-button" onClick={() => setExpanded(true)}>View all activity</button>}
      {expanded && !cursor && data.entries.length > 3 && <button type="button" className="fca-history-button" onClick={() => setExpanded(false)}>Show recent activity</button>}
      {cursor && <button type="button" className="fca-history-button" disabled={data.loading} onClick={() => setCursor(null)}>Newest activity</button>}
      {expanded && data.next && <button type="button" className="fca-history-button" disabled={data.loading || !!data.error}
        onClick={() => setCursor(data.next)}>Older activity</button>}
    </div>
  </section>;
}

export default function AccountDetails({ account, status, onBack }: { account: LinkedAccount; status: PlaidStatus | null; onBack: () => void }) {
  const [tab, setTab] = useState<'transactions' | 'details'>('transactions');
  const current = currentBalance(account);
  const available = account.connectionStatus === 'connected' && account.availableBalance !== null ? Number(account.availableBalance) : null;
  const useAvailable = accountGroup(account.accountType) === 'Cash' && available !== null && Number.isFinite(available);
  const amount = useAvailable ? available : current;
  const balanceLabel = useAvailable ? 'Available balance' : account.accountType === 'credit_card'
    ? current !== null && current < 0 ? 'Credit balance' : 'Amount owed' : 'Current balance';
  const connectionLabel = account.connectionStatus === 'reconnect_required' ? 'Reconnection needed' : 'Connected';
  const institutionLabel = [account.institution, account.mask && `••${account.mask}`].filter(Boolean).join(' · ');
  const detailRows = [
    ['Account', account.name], ['Institution & account', institutionLabel], ['Account type', accountGroup(account.accountType)],
    ['Balance type', balanceLabel], ['Currency', account.currency],
    ['Current balance', formatAccountMoney(current, account.currency)],
    ...(useAvailable ? [['Available balance', formatAccountMoney(available, account.currency)]] : []),
    ['Connection', `${connectionLabel} · ${updatedAt(account.balanceUpdatedAt)}`],
  ];
  return <div className="fca-account-detail">
    <button type="button" className="fca-back" onClick={onBack}>← Back to Accounts</button>
    <section className="fca-card fca-detail-hero" aria-label="Account balance">
      <span className="fca-icon">
        <img className="fca-institution-light" src={institutionIcon} alt="" />
        <img className="fca-institution-dark" src={institutionDarkIcon} alt="" />
      </span>
      <h1>{account.name}</h1><p className="fca-muted">{institutionLabel}</p>
      <p className="fca-muted">{balanceLabel}</p>
      <strong className="fca-detail-balance">{formatAccountMoney(balanceLabel === 'Credit balance' && amount !== null ? Math.abs(amount) : amount, account.currency)}</strong>
      <p className={`fca-detail-sync ${account.connectionStatus === 'reconnect_required' ? 'fca-status-warning' : 'fca-muted'}`}>{connectionLabel} · {updatedAt(account.balanceUpdatedAt)}</p>
    </section>
    <div className="fca-detail-tabs" role="tablist" aria-label="Account information">
      <button id="account-transactions-tab" type="button" role="tab" aria-selected={tab === 'transactions'} aria-controls="account-transactions-panel" onClick={() => setTab('transactions')}>Transactions</button>
      <button id="account-details-tab" type="button" role="tab" aria-selected={tab === 'details'} aria-controls="account-details-panel" onClick={() => setTab('details')}>Details</button>
    </div>
    {tab === 'transactions' ? <AccountHistory account={account} status={status} /> :
      <section id="account-details-panel" role="tabpanel" aria-labelledby="account-details-tab">
        <h2 className="fca-detail-title">Account details</h2>
        <dl className="fca-detail-facts">{detailRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      </section>}
    <p className="fca-muted fca-note">{status?.environment === 'sandbox' ? 'Sandbox · Fictional bank data. ' : ''}Balances reflect the last account import.</p>
  </div>;
}
