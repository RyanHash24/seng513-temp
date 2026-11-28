import { useState } from "react";
import { accountFilters, accountGroup, balanceTotals, currentBalance, formatAccountMoney, type AccountFilter } from "./linkedAccountData";
import { useSavedAccounts } from "./useSavedAccounts";
import type { LinkedAccount } from "./plaid";
import accountsIcon from "./assets/navigation/accounts.svg";
import ConnectBank from "./ConnectBank";
import AccountDetails from "./AccountDetails";

function accountDescription(account: LinkedAccount) {
  return [account.institution, account.mask && `••${account.mask}`,
    currentBalance(account) === null && "Balance unavailable"].filter(Boolean).join(" · ");
}

function importedAt(account: LinkedAccount) {
  if (!account.balanceUpdatedAt) return "";
  const date = new Date(account.balanceUpdatedAt);
  return Number.isNaN(date.getTime()) ? "" : `Updated ${new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium", timeStyle: "short",
  }).format(date)}`;
}

function AccountStatus({ account }: { account: LinkedAccount }) {
  return account.connectionStatus === "reconnect_required"
    ? <small className="fca-status-warning">Reconnection needed</small>
    : <small className="fca-status">Connected</small>;
}

function TotalBalance({ accounts, amountOwed = false }: { accounts: LinkedAccount[]; amountOwed?: boolean }) {
  const totals = balanceTotals(accounts, amountOwed);
  return <>{totals.length ? totals.map(total => <strong className="fca-value" key={total.currency}>
    {formatAccountMoney(total.balance, total.currency)}
  </strong>) : <strong className="fca-value">—</strong>}</>;
}

const styles = `
  .fc-accounts {
    --fca-surface: var(--fc-surface, #12221c);
    --fca-border: var(--fc-border, #263c31);
    --fca-muted: var(--fc-muted, #9bb0a3);
    --fca-accent: var(--fc-accent, #61d98f);
    --fca-selected: var(--fc-selected, #163d2a);
    --fca-subtle: var(--fc-subtle, #172a22);
    --fca-warning: var(--fc-warning, #ffbc68);
    --fca-cash-secondary: #36b64b;

    padding: 40px;
    background: var(--fc-background, #0b1512);
    color: var(--fc-text, #eafaf0);
    color-scheme: var(--fc-color-scheme, dark);
  }

  .fc-shell[data-theme="light"] .fc-accounts { --fca-cash-secondary: #528c6a; }
  .fc-shell[data-theme="light"] .fca-icon img { filter: brightness(0.52); }
  .fc-accounts * { box-sizing: border-box; }
  .fc-accounts :is(h1, h2, h3, p) { margin: 0; }
  .fc-accounts h1 { font-size: 30px; font-weight: 600; line-height: 1.25; }
  .fc-accounts h2 { font-size: 17px; font-weight: 500; }
  .fca-muted { color: var(--fca-muted); font-size: 13px; line-height: 1.5; }
  .fca-heading { margin-bottom: 28px; display: flex; justify-content: space-between; align-items: start; gap: 16px; flex-wrap: wrap; }
  .fca-heading p { margin-top: 8px; }

  .fca-summary, .fca-layout { display: grid; gap: 20px; }
  .fca-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .fca-layout {
    grid-template-columns: minmax(0, 7fr) minmax(205px, 3fr);
    align-items: start;
    margin-top: 28px;
  }

  .fca-card {
    min-width: 0;
    padding: 24px;
    border: 1px solid var(--fca-border);
    border-radius: 12px;
    background: var(--fca-surface);
  }

  .fca-highlight { background: var(--fca-selected); }
  .fca-value {
    display: block;
    margin: 8px 0;
    font-size: 30px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .fca-highlight .fca-value, .fca-status { color: var(--fca-accent); }
  .fca-summary .fca-value { font-size: clamp(20px, 2vw, 30px); white-space: nowrap; letter-spacing: -.02em; }
  .fca-status-warning { color: var(--fca-warning); }
  .fca-list { padding: 0; overflow: hidden; }
  .fca-groups { max-height: 540px; overflow-y: auto; }
  .fca-feedback { margin-bottom: 20px; }
  .fca-feedback p { margin-bottom: 12px; }
  .fca-heading-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .fca-heading-actions .fca-connect { margin-top: 0; }
  .fca-available { margin-top: 16px; }
  .fca-filters { display: flex; flex-wrap: wrap; gap: 4px; padding: 12px 16px; }

  .fc-accounts button { color: inherit; font: inherit; cursor: pointer; }
  .fc-accounts button:focus-visible {
    outline: 2px solid var(--fca-accent);
    outline-offset: 2px;
  }

  .fca-filter, .fca-back {
    min-height: 40px;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
  }

  .fc-accounts .fca-filter { color: var(--fca-muted); font-size: 13px; }
  .fc-accounts .fca-filter[aria-pressed="true"] {
    background: var(--fca-selected);
    color: var(--fca-accent);
    font-weight: 600;
  }

  .fca-group h2 {
    padding: 8px 16px;
    background: var(--fca-subtle);
    color: var(--fca-muted);
    font-size: 11px;
    text-transform: uppercase;
  }

  .fc-accounts .fca-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 10px 16px;
    border: 0;
    border-bottom: 1px solid var(--fca-border);
    background: transparent;
    text-align: left;
    font-size: 14px;
  }

  .fc-accounts .fca-row:hover { background: var(--fca-selected); }
  .fca-row span { min-width: 0; }
  .fca-row small { display: block; margin-top: 4px; font-size: 11px; }
  .fca-row-name { overflow-wrap: anywhere; }
  .fca-row-amount { min-width: 85px; text-align: right; white-space: nowrap; }

  .fca-icon {
    display: grid;
    width: 40px;
    height: 40px;
    place-items: center;
    border-radius: 8px;
    background: var(--fca-subtle);
  }

  .fca-empty { padding: 24px; }

  .fca-empty-state {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 12px;
    min-height: 320px;
    text-align: center;
  }

  .fca-empty-state .fca-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    background: var(--fca-selected);
  }

  .fca-empty-state p { max-width: 36ch; }

  .fc-accounts .fca-connect {
    min-height: 44px;
    margin-top: 4px;
    padding: 10px 18px;
    border: 0;
    border-radius: 8px;
    background: var(--fca-accent);
    color: var(--fc-on-accent, #0b1512);
    font-weight: 600;
  }

  .fca-track {
    display: flex;
    gap: 4px;
    height: 12px;
    margin: 16px 0;
    overflow: hidden;
    border-radius: 4px;
    background: var(--fca-border);
  }

  .fca-track span { background: var(--fca-accent); }
  .fca-track span:nth-child(even) { background: var(--fca-cash-secondary); }
  .fca-cash-list { margin: 0; }
  .fca-cash-list div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 0;
  }
  .fca-cash-list dd { margin: 0; white-space: nowrap; }
  .fc-accounts p.fca-note { margin-top: 16px; }

  .fca-attention {
    margin-top: 20px;
    border-color: var(--fca-warning);
    background: var(--fc-warning-surface, #2a2418);
    color: var(--fca-warning);
  }

  .fc-accounts .fca-back { margin-bottom: 12px; color: var(--fca-accent); }
  .fca-detail-summary { max-width: 640px; }
  .fca-detail-activity { max-width: 640px; margin-top: 20px; }

  @media (max-width: 950px) {
    .fca-layout { grid-template-columns: minmax(0, 1fr); }
  }

  @media (max-width: 700px) {
    .fc-accounts { padding: 24px 20px; }
    .fca-summary { grid-template-columns: minmax(0, 1fr); gap: 12px; }
    .fca-card { padding: 16px; }
    .fca-list { padding: 0; }
    .fc-accounts .fca-row { gap: 8px; padding-inline: 12px; }
    .fca-row-amount { min-width: 0; }
  }
`;

export default function Accounts({ connectOnOpen = false }: { connectOnOpen?: boolean }) {
  const { accounts, status, loading, error, reload } = useSavedAccounts();
  const [filter, setFilter] = useState<AccountFilter>("All accounts");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(connectOnOpen);
  const selected = accounts.find(account => account.id === selectedId);
  const connectedCash = accounts.filter(account => accountGroup(account.accountType) === "Cash" && account.connectionStatus === "connected");
  const cashWithBalance = connectedCash.filter(account => currentBalance(account) !== null);
  const cards = accounts.filter(account => accountGroup(account.accountType) === "Credit cards" && account.connectionStatus === "connected");
  const needsAttention = accounts.filter(account => account.connectionStatus === "reconnect_required" || currentBalance(account) === null);
  const cashCurrencies = new Set(cashWithBalance.map(account => account.currency));
  const showCashChart = cashCurrencies.size === 1 && cashWithBalance.length > 0 &&
    cashWithBalance.every(account => currentBalance(account)! >= 0) &&
    cashWithBalance.some(account => currentBalance(account)! > 0);
  const groups = accountFilters.filter(type => type !== "All accounts")
    .filter(type => filter === "All accounts" || filter === type)
    .map(type => ({ type, items: accounts.filter(account => accountGroup(account.accountType) === type) }))
    .filter(group => group.items.length > 0);
  const filters = accountFilters.filter(type => type !== "Other" || accounts.some(account => accountGroup(account.accountType) === "Other"));
  const dataLabel = status?.environment === "sandbox" ? "Sandbox · Fictional bank data" : "Linked bank data";

  function openAccount(id: string | null) {
    setSelectedId(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  if (connecting) return <ConnectBank onBack={() => setConnecting(false)}
    onContinue={() => { setConnecting(false); reload(); }} />;

  if (selected) return <div className="fc-accounts fca-detail-page"><style>{styles}</style>
    <AccountDetails key={selected.id} account={selected} status={status} onBack={() => openAccount(null)} />
  </div>;

  return <div className="fc-accounts" aria-busy={loading}>
    <style>{styles}</style>
    <header className="fca-heading">
      <div><h1>Your accounts</h1><p className="fca-muted">A clear view of your connected accounts and balances.</p></div>
      {accounts.length > 0 && <div className="fca-heading-actions">
        <button type="button" className="fca-back" disabled={loading} onClick={reload}>{loading ? "Refreshing…" : "Refresh accounts"}</button>
      </div>}
    </header>

    {loading && <p className="fca-muted fca-feedback" role="status">Loading your linked accounts…</p>}
    {error && <section className="fca-card fca-feedback" role="alert">
      <p>{error}</p><button type="button" className="fca-connect" onClick={reload}>Retry</button>
    </section>}

    {!loading && !error && accounts.length === 0 && <section className="fca-card fca-empty-state" aria-labelledby="fca-no-accounts">
      <span className="fca-icon"><img src={accountsIcon} alt="" /></span>
      <h2 id="fca-no-accounts">No accounts connected yet</h2>
      <p className="fca-muted">Connect an account to see your balances in FinClear.</p>
      <button type="button" className="fca-connect" onClick={() => setConnecting(true)}>Connect account</button>
    </section>}

    {accounts.length > 0 && <>
      <section className="fca-summary" aria-label="Account totals">
        <div className="fca-card fca-highlight">
          <p className="fca-muted">Connected cash accounts</p>
          <TotalBalance accounts={connectedCash} />
          <p className="fca-muted">{connectedCash.length} cash {connectedCash.length === 1 ? "account" : "accounts"}
            {connectedCash.length > cashWithBalance.length && ` · ${connectedCash.length - cashWithBalance.length} with unavailable balances`}</p>
        </div>
        <div className="fca-card">
          <p className="fca-muted">Credit card amount owed</p>
          <TotalBalance accounts={cards} amountOwed />
          <p className="fca-muted">{cards.length ? "Separate from connected cash; excludes credit balances." : "No connected credit cards."}</p>
        </div>
        <div className="fca-card">
          <p className="fca-muted">Needs attention</p>
          <strong className="fca-value">{needsAttention.length} {needsAttention.length === 1 ? "account" : "accounts"}</strong>
          <p className="fca-muted">{needsAttention.length === 1 ? needsAttention[0].name : needsAttention.length ? "Review your account connections below." : "Your linked accounts are up to date with the last import."}</p>
        </div>
      </section>

      <div className="fca-layout">
        <section className="fca-card fca-list" aria-label="Account list">
          <div className="fca-filters" role="group" aria-label="Filter by account type">
            {filters.map(option => <button key={option} type="button" className="fca-filter" aria-pressed={filter === option}
              onClick={() => setFilter(option)}>{option}</button>)}
          </div>
          <div className="fca-groups" tabIndex={0} aria-label="Linked accounts">
            {groups.map(({ type, items }) => <section className="fca-group" key={type} aria-label={type}>
              <h2>{type}</h2>
              {items.map(account => <button className="fca-row" type="button" key={account.id} onClick={() => openAccount(account.id)}>
                <span className="fca-icon"><img src={accountsIcon} alt="" /></span>
                <span className="fca-row-name">{account.name}
                  <small className="fca-muted">{accountDescription(account)}</small>
                  <AccountStatus account={account} />
                  <small className="fca-muted">{importedAt(account)}</small>
                </span>
                <span className="fca-row-amount">{formatAccountMoney(currentBalance(account), account.currency)}
                  {account.accountType === "credit_card" && <small className="fca-muted">{(currentBalance(account) ?? 0) < 0 ? "Credit balance" : "Amount owed"}</small>}
                </span>
                <span aria-hidden="true">›</span>
              </button>)}
            </section>)}
            {groups.length === 0 && <p className="fca-empty fca-muted">No accounts in this category.</p>}
          </div>
        </section>

        <section className="fca-card" aria-labelledby="fca-cash">
          <h2 id="fca-cash">Your connected cash</h2>
          <p className="fca-muted fca-note">Balances across your connected cash accounts.</p>
          {showCashChart && <div className="fca-track" aria-hidden="true">
            {cashWithBalance.map(account => <span key={account.id} style={{ flexGrow: currentBalance(account)! }} />)}
          </div>}
          <dl className="fca-cash-list">{cashWithBalance.map(account => <div key={account.id}>
            <dt className="fca-muted">{account.name}{account.mask && ` ••${account.mask}`}</dt>
            <dd>{formatAccountMoney(currentBalance(account), account.currency)}</dd>
          </div>)}</dl>
          {cashWithBalance.length === 0 && <p className="fca-muted fca-note">No connected cash balances available.</p>}
          <p className="fca-muted fca-note">Includes last imported balances of connected cash accounts. Credit cards, investments, loans, and unavailable balances are excluded. Different currencies are shown separately.</p>
        </section>
      </div>

      {needsAttention.length > 0 && <section className="fca-card fca-attention" aria-label="Connection status">
        <h2>{needsAttention.length === 1 ? "One account needs attention" : "Accounts need attention"}</h2>
        {needsAttention.map(account => <p className="fca-note" key={account.id}>
          {account.name}{account.mask && ` ••${account.mask}`}: {account.connectionStatus === "reconnect_required"
            ? "Reconnect this bank in Settings → Connected Accounts to refresh its balance."
            : "A balance was not available in the latest import."}
        </p>)}
      </section>}
      <p className="fca-muted fca-note">{dataLabel} · Balances reflect the last account import · Amounts shown in account currency</p>
    </>}
  </div>;
}
