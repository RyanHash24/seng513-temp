import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { AuthUser } from './auth';
import { accountExport, browserAccountData, clearBrowserAccountData, privacyRequest } from './privacyData';
import './DataPrivacy.css';

type Action = 'export' | 'delete-account';

function PrivacyDialog({ action, user, onClose, onDeleted }: {
  action: Action; user: AuthUser; onClose: () => void; onDeleted: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<{ url: string; filename: string } | null>(null);
  const fileUrl = useRef('');
  const [downloadRequested, setDownloadRequested] = useState(false);
  const deleting = action === 'delete-account';
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    node?.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      // Export preparation can be cancelled. Deletion cannot be represented as
      // cancelled after it reaches the server, so its request is never aborted.
      if (!deleting) controller.current?.abort();
      if (fileUrl.current) URL.revokeObjectURL(fileUrl.current);
      node?.close();
    };
  }, [deleting]);

  function close() {
    if (busyRef.current && deleting) return;
    controller.current?.abort();
    dialog.current?.close();
    onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError('');
    controller.current = new AbortController();
    try {
      // Read browser records first: if storage is inaccessible, the export must
      // not silently claim to contain the locally saved budget and preferences.
      const browser = deleting ? null : browserAccountData(user.id);
      const response = await privacyRequest(action, { password, ...(deleting ? { email, confirmation } : {}) },
        deleting ? undefined : controller.current.signal);
      if (deleting) {
        if (response.status !== 204) throw new Error('The deletion result could not be confirmed. Please sign in again to check your account.');
        const cleared = clearBrowserAccountData(user.id);
        onDeleted(cleared ? 'Your FinClear account was deleted.'
          : 'Your FinClear account was deleted. Some saved data could not be removed from this browser; clear this site’s data on this device.');
      } else {
        const data = await response.json().catch(() => { throw new Error('The export response was invalid. Please try again.'); });
        const contents = accountExport(data, user.id, browser);
        if (controller.current.signal.aborted) return;
        const blob = new Blob([contents], { type: 'application/json' });
        fileUrl.current = URL.createObjectURL(blob);
        setFile({ url: fileUrl.current, filename: `finclear-account-${new Date().toISOString().slice(0, 10)}.json` });
      }
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Your request could not be completed.');
    } finally { setPassword(''); setBusy(false); busyRef.current = false; }
  }
  return <dialog className="fc-privacy-dialog" ref={dialog} aria-labelledby="privacy-dialog-title"
    onCancel={event => { event.preventDefault(); close(); }}>
    <h2 id="privacy-dialog-title">{deleting ? 'Delete your FinClear account?' : 'Export your account data'}</h2>
    {deleting ? <>
      <p>This permanently removes your profile and saved financial records from FinClear’s active database, disconnects your linked Sandbox banks and signs you out.</p>
      <p>Your budget and account preferences saved in this browser are cleared. Copies in other browsers, downloaded files and backups aren’t erased. Your bank accounts remain open. This action cannot be undone.</p>
    </> : <p>Confirm your password to prepare a JSON file containing your profile, settings, connected accounts, transactions, budgets, savings and notifications.</p>}
    {file ? <div className="fc-privacy-ready">
      <p role="status">Your export is ready. It also includes your budget and account preferences saved in this browser. Passwords and bank access tokens are excluded.</p>
      <a className="fc-privacy-download" href={file.url} download={file.filename} onClick={() => setDownloadRequested(true)}>Download JSON</a>
      {downloadRequested && <p role="status">Download requested. You can use the link again if needed.</p>}
      <button type="button" onClick={close}>Done</button>
    </div> : <form onSubmit={event => void submit(event)} aria-busy={busy}>
      <label>Current password<input type="password" autoComplete="current-password" required maxLength={1024}
        value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
      {deleting && <>
        <label>Account email<input type="email" autoComplete="off" required maxLength={254}
          placeholder={user.email} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></label>
        <label>Type DELETE to confirm<input type="text" autoComplete="off" required spellCheck={false}
          value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>
      </>}
      {error && <p className="fc-privacy-error" role="alert">{error}</p>}
      {busy && <p role="status">{deleting ? 'Disconnecting banks and deleting your account. Please keep this page open…' : 'Preparing your complete account export…'}</p>}
      <div className="fc-privacy-actions">
        <button type="button" onClick={close} disabled={busy && deleting}>{busy && !deleting ? 'Cancel export' : 'Cancel'}</button>
        <button className={deleting ? 'fc-privacy-delete' : 'fc-privacy-primary'} type="submit"
          disabled={busy || !password || deleting && (confirmation !== 'DELETE' || email.trim().toLowerCase() !== user.email.toLowerCase())}>
          {busy ? (deleting ? 'Deleting…' : 'Preparing…') : deleting ? 'Permanently delete account' : 'Prepare export'}
        </button>
      </div>
    </form>}
  </dialog>;
}

export default function DataPrivacy({ user, onDeleted }: { user: AuthUser; onDeleted: (message: string) => void }) {
  const [action, setAction] = useState<Action | null>(null);
  const exportButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  function close() {
    setAction(null);
    (action === 'export' ? exportButton : deleteButton).current?.focus();
  }
  return <div className="fc-settings-body fc-privacy">
    <section aria-labelledby="privacy-export-title">
      <h2 id="privacy-export-title">Export your data</h2>
      <p>Download all your saved FinClear records as JSON, including transactions across all dates and accounts. Your current browser’s saved budget and account preferences are included.</p>
      <p>The file contains personal and financial information. Passwords and bank access tokens are excluded.</p>
      <button type="button" ref={exportButton} onClick={() => setAction('export')}>Export account data</button>
    </section>
    <section className="fc-privacy-danger" aria-labelledby="privacy-delete-title">
      <h2 id="privacy-delete-title">Delete your account</h2>
      <p>Permanently remove your FinClear account and saved data, disconnect linked Sandbox banks and sign out. You’ll confirm your password, email and the word DELETE before proceeding.</p>
      <p>Accounts with live bank connections cannot be deleted from this Sandbox preview.</p>
      <button className="fc-privacy-delete" type="button" ref={deleteButton} onClick={() => setAction('delete-account')}>Delete account</button>
    </section>
    {action && <PrivacyDialog action={action} user={user} onClose={close} onDeleted={onDeleted} />}
  </div>;
}
