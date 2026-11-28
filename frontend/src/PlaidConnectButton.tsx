import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { plaidRequest, type PlaidEnvironment, type PlaidStatus } from './plaid';
import { usePlaidStatus } from './usePlaidStatus';

type BankImport = { connectionId: string; environment: PlaidEnvironment };
type Completion = { importBankHistory: boolean; sessionId: string; publicToken?: string; accountIds?: string[]; environment: PlaidEnvironment };

export default function PlaidConnectButton({ onConnected, className = 'settings-save', connectionId, status: suppliedStatus, product }: {
  onConnected?: () => void; className?: string; connectionId?: string; status?: PlaidStatus; product?: 'investments';
}) {
  const { status, error: configurationError } = usePlaidStatus(suppliedStatus);
  const [session, setSession] = useState<{ token: string; id: string; environment: PlaidEnvironment } | null>(null);
  const [pending, setPending] = useState<Completion | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [bankImport, setBankImport] = useState<BankImport | null>(null);

  async function importTransactions(bank: BankImport) {
    setBusy(true);
    setBankImport(bank);
    setMessage('Bank connected. Importing transactions…');
    try {
      const result = await plaidRequest<{ added: number; updateStatus: string }>('sync', bank.environment,
        { body: { connectionId: bank.connectionId } });
      if (!result.added && ['NOT_READY', 'INITIAL_UPDATE_COMPLETE', 'TRANSACTIONS_UPDATE_STATUS_UNKNOWN'].includes(result.updateStatus)) {
        setMessage('Your accounts are connected. Plaid is preparing transaction history. Retry shortly or continue and sync from Activity.');
        return;
      }
      setBankImport(null);
      setMessage('Bank connected. Available transactions imported.');
      onConnected?.();
    } catch {
      setMessage('Your accounts are connected. The transaction import failed. Retry here or sync from Activity.');
    } finally {
      setBusy(false);
    }
  }
  async function finish(completion: Completion) {
    setBusy(true); setMessage(connectionId ? 'Confirming account access…' : 'Saving linked accounts…');
    try {
      const { importBankHistory, ...request } = completion;
      const saved = await plaidRequest<{ connectionId: string }>(connectionId ? 'update' : 'exchange', completion.environment, { body: request });
      setPending(null);
      setSession(null);
      if (importBankHistory) {
        await importTransactions({ connectionId: saved.connectionId, environment: completion.environment });
        return;
      }
      setMessage(connectionId ? product === 'investments' ? 'Investment activity authorized. You can sync it now.' : 'Bank reconnected successfully.' : 'Bank connected successfully.');
      onConnected?.();
    } catch (cause) {
      if (cause instanceof Error && 'connectionId' in cause && cause.connectionId) setPending(null);
      setMessage(cause instanceof Error ? cause.message : 'Unable to save your bank connection.');
    }
    finally { setSession(null); setBusy(false); }
  }
  const { open, ready, error } = usePlaidLink({
    token: session?.token || null,
    onSuccess: async (publicToken, metadata) => {
      if (!session) return;
      const completion: Completion = { sessionId: session.id, environment: session.environment,
        importBankHistory: !connectionId && !product && metadata.accounts.some(account => account.type !== 'investment'),
        ...(connectionId ? {} : { publicToken, accountIds: metadata.accounts.map(account => account.id) }) };
      setPending(completion);
      await finish(completion);
    },
    onExit: cause => {
      setSession(null); setBusy(false);
      setMessage(cause ? 'Bank linking could not be completed. Please try again.' : 'Bank linking cancelled.');
    },
  });
  useEffect(() => { if (session && ready) open(); }, [session, ready, open]);
  async function start() {
    if (!status?.configured) return;
    setBusy(true); setMessage(''); setSession(null); setPending(null);
    try {
      const data = await plaidRequest<{ linkToken: string; sessionId: string }>('link-token', status.environment,
        { body: { ...(connectionId ? { connectionId } : {}), ...(product ? { product } : {}) } });
      setSession({ token: data.linkToken, id: data.sessionId, environment: status.environment });
    }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Unable to start bank linking.'); setBusy(false); }
  }
  if (bankImport) return <div>
    <p role="status">{message}</p>
    {!busy && <>
      <button type="button" className={className} onClick={() => void importTransactions(bankImport)}>Retry import</button>
      <button type="button" className={className} onClick={() => { setBankImport(null); onConnected?.(); }}>Continue</button>
    </>}
  </div>;
  return <div>
    {!suppliedStatus && status && <p>{status.environment === 'sandbox' ? 'Sandbox · Test bank connections' : 'Live bank connections'}</p>}
    <button className={className} type="button" onClick={() => void start()} disabled={!status?.configured || (busy && !error)}>
      {busy && !error ? 'Connecting…' : connectionId ? product === 'investments' ? 'Enable investment activity' : 'Reconnect' : product === 'investments' ? 'Connect an investment account' : status?.environment === 'production' ? 'Connect a real bank' : 'Connect with Plaid'}
    </button>
    {pending && !busy && <button type="button" className={className} onClick={() => void finish(pending)}>Retry saving</button>}
    {error ? <p role="alert">Unable to load Plaid. Check your connection and try again.</p> : message && <p role="status">{message}</p>}
    {configurationError && <p role="alert">{configurationError}</p>}
    {status && !status.configured && <p role="status">Bank connections are not enabled for this environment.</p>}
  </div>;
}
