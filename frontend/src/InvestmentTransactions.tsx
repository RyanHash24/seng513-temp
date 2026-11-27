import { useEffect, useState } from 'react';
import { plaidRequest, type PlaidStatus } from './plaid';

type Cursor = { date: string; id: string };
type Activity = { id: string; description: string; accountName: string; institution: string; date: string;
  amount: string | null; currency: string | null; unofficialCurrency: string | null;
  type: string; subtype: string | null; ticker: string | null; securityName: string | null;
  quantity: string | null; fees: string | null; cancelTransactionId: string | null };

function cashChange(activity: Activity) {
  if (activity.amount === null) return 'Unavailable';
  if (!activity.currency) return `${activity.amount} ${activity.unofficialCurrency || '(currency unavailable)'}`;
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: activity.currency,
    currencyDisplay: 'code', signDisplay: 'exceptZero' }).format(Number(activity.amount));
}

export default function InvestmentTransactions({ status }: { status: PlaidStatus | null }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const [nextCursor, setNextCursor] = useState<Cursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!status?.configured) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError('');
      try {
        const query = cursor ? `?${new URLSearchParams({ beforeDate: cursor.date, beforeId: cursor.id })}` : '';
        const data = await plaidRequest<{ transactions: Activity[]; nextCursor: Cursor | null }>(
          `investments/transactions${query}`, status!.environment, { signal: controller.signal });
        if (!controller.signal.aborted) { setActivities(data.transactions); setNextCursor(data.nextCursor); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load investment activity.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [cursor, revision, status]);
  if (!status?.configured) return null;
  return <section className="transaction-table-container bank-transactions" aria-label="Investment activity">
    <h2>Investment activity</h2>
    <p className="bank-history-note">{status.environment === 'sandbox' ? 'Sandbox · Fictional investment data. ' : 'Live investment data. '}
      Trades, dividends, fees and transfers are separate from budget spending. Cash change shows money entering (+) or leaving (−) the investment account.</p>
    {loading && <p role="status">Loading investment activity…</p>}
    {error && <p role="alert">{error} <button type="button" className="primary-button" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    {!loading && !error && !activities.length && <p>No investment activity saved yet. In Settings, enable investment activity on your existing connection, then sync it.</p>}
    {!loading && !error && activities.length > 0 && <div className="transaction-table-scroll"><table className="transaction-table">
      <thead><tr><th>Date</th><th>Activity</th><th>Account</th><th>Type</th><th>Security / quantity</th><th>Cash change</th></tr></thead>
      <tbody>{activities.map(activity => <tr key={activity.id}>
        <td>{activity.date}</td><td>{activity.description}</td>
        <td>{activity.accountName}<small>{activity.institution}</small></td>
        <td>{(activity.subtype || activity.type).replaceAll('_', ' ')}{activity.cancelTransactionId && <small>Reversal</small>}</td>
        <td>{activity.ticker || activity.securityName || '—'}{activity.quantity !== null && Number(activity.quantity) !== 0 && <small>{activity.quantity} units</small>}</td>
        <td className={activity.amount === null ? '' : Number(activity.amount) < 0 ? 'negative' : 'positive'}>{cashChange(activity)}</td>
      </tr>)}</tbody>
    </table></div>}
    <div className="bank-pagination">
      {cursor && <button type="button" className="primary-button" disabled={loading} onClick={() => setCursor(null)}>Newest activity</button>}
      {nextCursor && <button type="button" className="primary-button" disabled={loading || !!error} onClick={() => setCursor(nextCursor)}>Older activity</button>}
    </div>
  </section>;
}
