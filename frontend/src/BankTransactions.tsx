import { useEffect, useState } from 'react';
import SyncBankButton from './SyncBankButton';
import InvestmentTransactions from './InvestmentTransactions';
import { plaidRequest, type PlaidConnection } from './plaid';
import { usePlaidStatus } from './usePlaidStatus';

type BankTransaction = { id: string; description: string; accountName: string; institution: string;
  amount: string; currency: string; category: string; date: string; kind: string; status: string };
type Cursor = { date: string; id: string };

export default function BankTransactions({ onChanged }: { onChanged?: () => void }) {
  const { status, error: configurationError } = usePlaidStatus();
  const [connections, setConnections] = useState<PlaidConnection[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  function reload() { setCursor(null); setRevision(value => value + 1); onChanged?.(); }
  useEffect(() => {
    if (!status?.configured) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError('');
      try {
        const query = cursor ? `?${new URLSearchParams({ beforeDate: cursor.date, beforeId: cursor.id })}` : '';
        const [history, banks] = await Promise.all([
          plaidRequest<{ transactions: BankTransaction[]; nextCursor: Cursor | null }>(`transactions${query}`, status!.environment, { signal: controller.signal }),
          plaidRequest<{ connections: PlaidConnection[] }>('connections', status!.environment, { signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) { setTransactions(history.transactions); setNextCursor(history.nextCursor); setConnections(banks.connections); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load bank transactions.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [cursor, revision, status]);
  return <><section className="transaction-table-container bank-transactions" aria-label="Bank transactions">
    <h2>Bank transactions</h2>
    <p className="bank-history-note">{status?.environment === 'production' ? 'Live bank data' : 'Sandbox · Fictional bank data'}. Sync retrieves available bank updates using your existing connection.</p>
    <div className="bank-sync-list">{connections.map(connection => <div className="bank-sync-row" key={connection.id}>
      <div><strong>{connection.institution}</strong>
        {connection.hasTransactionAccounts && <p>{connection.transactionsSyncedAt ? `Bank transactions synced ${new Date(connection.transactionsSyncedAt).toLocaleString()}` : 'Bank transactions have not been synced yet.'}</p>}
        {connection.hasInvestmentAccounts && <p>{connection.investmentsSyncedAt ? `Investment activity synced ${new Date(connection.investmentsSyncedAt).toLocaleString()}` : 'Investment activity has not been synced yet.'}</p>}
        {connection.hasInvestmentAccounts && (!connection.investmentsStatus || connection.investmentsStatus === 'consent_required') && <p>Enable investment activity above using your existing connection.</p>}
        {connection.status === 'reconnect_required' && <p>Reconnect this bank in Settings to resume syncing.</p>}
        {connection.hasTransactionAccounts && connection.transactionsUpdateStatus === 'INITIAL_UPDATE_COMPLETE' && <p>Recent transactions are ready. Sync again shortly for the remaining history.</p>}
      </div>
      {status && <>{connection.hasTransactionAccounts && <SyncBankButton connectionId={connection.id} onSynced={reload} environment={status.environment} />}
        {connection.hasInvestmentAccounts && <SyncBankButton connectionId={connection.id} investment onSynced={reload} environment={status.environment} />}</>}
    </div>)}</div>
    {error && <p role="alert">{error} <button type="button" className="primary-button" onClick={reload}>Retry</button></p>}
    {configurationError && <p role="alert">{configurationError}</p>}
    {status && !status.configured && <p role="status">Bank connections are not enabled for this environment.</p>}
    {!configurationError && (!status || (status.configured && loading)) && <p role="status">Loading bank transactions…</p>}
    {!loading && !error && !connections.length && <p>Connect an account above to get started.</p>}
    {!loading && !error && connections.length > 0 && !transactions.length && <p>No bank transactions on this page. Investment activity appears separately below.</p>}
    {!loading && !error && transactions.length > 0 && <div className="transaction-table-scroll"><table className="transaction-table">
      <thead><tr><th>Date</th><th>Transaction</th><th>Account</th><th>Category</th><th>Status</th><th>Amount</th></tr></thead>
      <tbody>{transactions.map(transaction => <tr key={transaction.id}>
        <td>{transaction.date}</td><td>{transaction.description}</td><td>{transaction.accountName}<small>{transaction.institution}</small></td>
        <td>{transaction.category}</td><td>{transaction.status === 'pending' ? 'Pending' : 'Posted'}{transaction.kind === 'transfer' ? ' · Transfer' : ''}</td>
        <td className={Number(transaction.amount) < 0 ? 'negative' : 'positive'}>{new Intl.NumberFormat('en-CA', {
          style: 'currency', currency: transaction.currency, currencyDisplay: 'code', signDisplay: 'exceptZero',
        }).format(Number(transaction.amount))}</td>
      </tr>)}</tbody>
    </table></div>}
    <div className="bank-pagination">
      {cursor && <button type="button" className="primary-button" disabled={loading} onClick={() => setCursor(null)}>Newest transactions</button>}
      {nextCursor && <button type="button" className="primary-button" disabled={loading || !!error} onClick={() => setCursor(nextCursor)}>Older transactions</button>}
    </div>
  </section><InvestmentTransactions key={revision} status={status} /></>;
}
