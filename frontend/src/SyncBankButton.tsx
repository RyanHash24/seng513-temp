import { useState } from 'react';
import { plaidRequest, type PlaidEnvironment } from './plaid';

export default function SyncBankButton({ connectionId, onSynced, environment, investment = false }: {
  connectionId: string; onSynced: () => void; environment: PlaidEnvironment; investment?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function sync() {
    setBusy(true); setMessage(''); setFailed(false);
    try {
      const data = await plaidRequest<{ added: number; modified: number; removed: number; skipped: number; updateStatus: string }>(
        investment ? 'investments/sync' : 'sync', environment, { body: { connectionId } });
      const waiting = data.updateStatus === 'NOT_READY' || data.updateStatus === 'INITIAL_UPDATE_COMPLETE';
      setMessage(investment ? `${data.added} added, ${data.modified} updated. Available investment activity synced; older history may arrive later.` : `${data.added} added, ${data.modified} updated, ${data.removed} removed.${waiting ? ' Bank history is still loading. Sync again shortly.' : ''}${data.skipped ? ` ${data.skipped} updates belong to accounts that are not saved here.` : ''}`);
      onSynced();
    } catch (cause) {
      setFailed(true); setMessage(cause instanceof Error ? cause.message : 'Unable to sync transactions.'); onSynced();
    } finally { setBusy(false); }
  }
  return <div className="bank-sync-control">
    <button type="button" className="primary-button" disabled={busy} onClick={() => void sync()}>{busy ? 'Syncing…' : investment ? 'Sync investment activity' : 'Sync transactions'}</button>
    {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
  </div>;
}
