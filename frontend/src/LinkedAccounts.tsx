import { useCallback, useEffect, useState } from 'react';
import PlaidConnectButton from './PlaidConnectButton';
import SyncBankButton from './SyncBankButton';
import { plaidRequest, type PlaidConnection } from './plaid';
import { usePlaidStatus } from './usePlaidStatus';

type LinkedAccount = {
  id: string; name: string; mask: string | null; currency: string;
  currentBalance: string | null; availableBalance: string | null;
  balanceUpdatedAt: string | null; institution: string;
};

export default function LinkedAccounts({ onChanged }: { onChanged?: () => void }) {
  const { status, error: configurationError } = usePlaidStatus();
  const [connections, setConnections] = useState<PlaidConnection[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    setRevision(value => value + 1);
    onChanged?.();
  }, [onChanged]);
  useEffect(() => {
    if (!status?.configured) return;
    const controller = new AbortController();
    async function load() {
      try {
        const [data, banks] = await Promise.all([
          plaidRequest<{ accounts: LinkedAccount[] }>('accounts', status!.environment, { signal: controller.signal }),
          plaidRequest<{ connections: PlaidConnection[] }>('connections', status!.environment, { signal: controller.signal }),
        ]);
        if (!controller.signal.aborted) { setAccounts(data.accounts); setConnections(banks.connections); setError(''); }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load linked accounts.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [revision, status]);
  return <section className="settings-card">
    <h2>Linked bank accounts</h2>
    <p>{status?.environment === 'production' ? 'Live bank data' : 'Sandbox · Fictional bank data'}. Balances reflect the most recent import.</p>
    {status && <div className="settings-actions"><PlaidConnectButton onConnected={reload} status={status} />
      <PlaidConnectButton onConnected={reload} status={status} product="investments" /></div>}
    <p>Already linked your bank? Use Reconnect below to keep the existing connection.</p>
    <ul className="linked-accounts">{connections.map(connection => <li key={connection.id}>
      <strong>{connection.institution}</strong><span>{connection.status.replaceAll('_', ' ')}</span>
      {status && <><PlaidConnectButton connectionId={connection.id} onConnected={reload} status={status} />
      {connection.hasTransactionAccounts && <SyncBankButton connectionId={connection.id} onSynced={reload} environment={status.environment} />}
      {connection.hasInvestmentAccounts && <>
        {(!connection.investmentsStatus || connection.investmentsStatus === 'consent_required') &&
          <PlaidConnectButton connectionId={connection.id} product="investments" onConnected={reload} status={status} />}
        <SyncBankButton connectionId={connection.id} investment onSynced={reload} environment={status.environment} />
        <p>Investment activity appears separately from bank transactions below.</p>
      </>}</>}
    </li>)}</ul>
    {!configurationError && (!status || (status.configured && loading)) && <p role="status">Loading linked accounts…</p>}
    {configurationError && <p role="alert">{configurationError}</p>}
    {error && <p role="alert">{error} <button type="button" onClick={reload}>Retry</button></p>}
    {!loading && !error && !accounts.length && <p>{connections.length ? 'Reconnect your bank to make its accounts available again.' : 'No bank accounts connected yet.'}</p>}
    <ul className="linked-accounts">{accounts.map(account => <li key={account.id}>
      <strong>{account.name}{account.mask ? ` ••${account.mask}` : ''}</strong>
      <span>{account.institution}</span>
      <span>{account.currentBalance === null ? 'Balance unavailable' : new Intl.NumberFormat('en-CA', { style: 'currency', currency: account.currency }).format(Number(account.currentBalance))}</span>
    </li>)}</ul>
  </section>;
}
