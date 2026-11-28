import { useEffect, useRef, useState, type FormEvent } from 'react';
import { passwordChangeResult, passwordValidation, securityDetails, securityRequest, type SecurityDetails } from './securityData';
import './SecuritySettings.css';

function SignOutAll({ onClose, onSignedOut }: { onClose: () => void; onSignedOut: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const node = dialog.current; node?.showModal(); node?.querySelector('input')?.focus(); return () => node?.close(); }, []);
  function close() { if (!pending.current) { dialog.current?.close(); onClose(); } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await securityRequest('signout-all', { currentPassword: password });
      if (response.status !== 204) throw new Error('Sign-out could not be confirmed. Please sign in again to check your session.');
      onSignedOut('You’ve been signed out of all FinClear sessions.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign out. Please try again.'); }
    finally { setPassword(''); pending.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} className="fc-security-dialog" aria-labelledby="signout-all-title" onCancel={event => { event.preventDefault(); close(); }}>
    <h2 id="signout-all-title">Sign out all sessions?</h2>
    <p>This includes this browser. You’ll need your password to sign in again. Your saved data and bank connections are kept.</p>
    <form onSubmit={event => void submit(event)} aria-busy={busy}>
      <label>Current password<input type="password" autoComplete="current-password" required maxLength={1024} disabled={busy}
        value={password} onChange={event => setPassword(event.target.value)} /></label>
      {error && <p className="fc-security-error" role="alert">{error}</p>}
      {busy && <p role="status">Signing out all sessions…</p>}
      <div className="fc-security-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button>
        <button type="submit" className="fc-security-primary" disabled={busy || !password}>{busy ? 'Signing out…' : 'Sign out all sessions'}</button></div>
    </form>
  </dialog>;
}

export default function SecuritySettings({ onSignedOut, onPasswordChanged }: {
  onSignedOut: (message: string) => void; onPasswordChanged: () => void;
}) {
  const [details, setDetails] = useState<SecurityDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [revision, setRevision] = useState(0);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const progress = useRef<HTMLDialogElement>(null);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const signOutButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setLoadError('');
      try {
        const response = await securityRequest('', undefined, controller.signal);
        const data = securityDetails(await response.json().catch(() => null));
        if (!controller.signal.aborted) setDetails(data);
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : 'Unable to load security details.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [revision]);
  useEffect(() => {
    const node = progress.current;
    if (busy) node?.showModal(); else node?.close();
    return () => node?.close();
  }, [busy]);
  function clear() { setCurrent(''); setPassword(''); setConfirmation(''); setVisible(false); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const issue = passwordValidation(current, password, confirmation);
    if (issue) { setFeedback({ message: issue, error: true }); return; }
    pending.current = true; setBusy(true); setFeedback(null);
    try {
      const response = await securityRequest('password', { currentPassword: current, newPassword: password, confirmPassword: confirmation });
      const data = await response.json().catch(() => null);
      const changedAt = passwordChangeResult(data);
      onPasswordChanged();
      setDetails(previous => previous ? { ...previous, passwordChangedAt: changedAt } : previous);
      setFeedback({ message: 'Your password was updated. Other sessions were signed out; you’re still signed in here.', error: false });
    } catch (cause) { setFeedback({ message: cause instanceof Error ? cause.message : 'The password change could not be confirmed.', error: true }); }
    finally { clear(); setBusy(false); pending.current = false; }
  }
  const ready = !loading && !loadError && !!details;
  const passwordReady = ready && details.signInMethod === 'password';
  return <div className="fc-settings-body fc-security">
    {loading && <p role="status">Loading security details…</p>}
    {loadError && <div role="alert"><p className="fc-security-error">{loadError}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
    {ready && <dl className="fc-security-summary">
      <div><dt>Sign-in method</dt><dd>{details.signInMethod === 'google' ? 'Google' : 'Email and password'}</dd></div>
      <div><dt>Email</dt><dd>{details.email}</dd></div>
      <div><dt>Password last changed</dt><dd>{details.passwordChangedAt ? new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(details.passwordChangedAt)) : 'Not recorded'}</dd></div>
    </dl>}
    {ready && !passwordReady && <p role="status">You use Google to sign in. Password changes and password-confirmed sign-out of all sessions are unavailable here. You can still log out of this browser in Settings.</p>}
    <section aria-labelledby="change-password-title">
      <h2 id="change-password-title">Change password</h2>
      <p>Use 7–128 characters, including at least one special character. Changing your password signs out other sessions.</p>
      <form onSubmit={event => void submit(event)} aria-busy={busy}>
        <label>Current password<input type={visible ? 'text' : 'password'} autoComplete="current-password" required maxLength={1024}
          value={current} onChange={event => setCurrent(event.target.value)} disabled={busy || !passwordReady} /></label>
        <label>New password<input type={visible ? 'text' : 'password'} autoComplete="new-password" required maxLength={128} aria-describedby="password-rule"
          value={password} onChange={event => setPassword(event.target.value)} disabled={busy || !passwordReady} /></label>
        <label>Confirm new password<input type={visible ? 'text' : 'password'} autoComplete="new-password" required maxLength={128}
          value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy || !passwordReady} /></label>
        <p id="password-rule">Use a different password from your current one.</p>
        <label className="fc-security-show"><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} disabled={busy || !passwordReady} />Show passwords</label>
        {feedback && <p className={feedback.error ? 'fc-security-error' : 'fc-security-success'} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
        {busy && <p role="status">Updating your password…</p>}
        <div className="fc-security-actions"><button type="button" disabled={busy} onClick={() => { clear(); setFeedback(null); }}>Cancel</button>
          <button className="fc-security-primary" type="submit" disabled={busy || !passwordReady || !current || !password || !confirmation}>{busy ? 'Updating…' : 'Update password'}</button></div>
      </form>
    </section>
    <section className="fc-security-sessions" aria-labelledby="security-sessions-title">
      <h2 id="security-sessions-title">Sign-in sessions</h2>
      <p>{details ? `Sessions last up to ${details.sessionLifetimeMinutes} minutes. ` : ''}Sign out every FinClear session, including this browser.</p>
      <button ref={signOutButton} type="button" onClick={() => setSignOutOpen(true)} disabled={busy || !passwordReady}>Sign out all sessions</button>
    </section>
    {signOutOpen && <SignOutAll onSignedOut={onSignedOut} onClose={() => { setSignOutOpen(false); signOutButton.current?.focus(); }} />}
    <dialog ref={progress} className="fc-security-dialog" aria-labelledby="password-progress-title" onCancel={event => event.preventDefault()}>
      <h2 id="password-progress-title">Updating your password</h2><p role="status">Please keep this page open while your password and sessions are updated.</p>
    </dialog>
  </div>;
}
