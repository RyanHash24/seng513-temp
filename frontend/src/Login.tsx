import { useState, type FormEvent } from 'react';
import '@fontsource-variable/inter';
import logo from './assets/auth/finclear-logo.png';
import google from './assets/auth/google.svg';
import './Login.css';
import { startGoogle } from './auth';
import { useAuthTheme } from './useAuthTheme';

export default function Login({ onSubmit, onCreateAccount, onForgotPassword, afterLogout = false, initialError = '', initialNotice = '' }: {
  onSubmit: (credentials: { email: string; password: string }) => Promise<void>;
  afterLogout?: boolean;
  initialError?: string;
  initialNotice?: string;
  onCreateAccount?: () => void;
  onForgotPassword: () => void;
}) {
  const theme = useAuthTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Some password managers ignore autocomplete="off" on editable login fields.
  const [emailEditable, setEmailEditable] = useState(!afterLogout);
  const [passwordEditable, setPasswordEditable] = useState(!afterLogout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(initialNotice);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    // A still-unfocused, read-only field doesn't participate in native required validation.
    if (!email || !password) {
      const missing = event.currentTarget.elements.namedItem(!email ? 'email' : 'password') as HTMLInputElement;
      missing.focus();
      requestAnimationFrame(() => missing.reportValidity());
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await onSubmit({ email, password });
      setPassword('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to log in. Please try again.');
    } finally { setBusy(false); }
  }

  return (
    <main className="login-page" data-theme={theme}>
      <div className="login-brand" aria-label="FinClear">
        <span className="login-logo"><img src={logo} alt="" /></span><span>FinClear</span>
      </div>
      <div className="login-layout">
        <section className="login-welcome" aria-labelledby="login-heading">
          <span className="login-badge">WELCOME BACK</span>
          <div><h1 id="login-heading">Log in to your plan.</h1><p>Pick up where you left off.</p></div>
        </section>
        <form className="login-form" onSubmit={submit} aria-label="Log in" aria-busy={busy} autoComplete={afterLogout ? 'off' : undefined}>
          <div className="login-credentials">
            <label htmlFor="login-email">Email
              <input id="login-email" name="email" type="email" autoComplete={afterLogout ? 'off' : 'username'} placeholder="you@example.com" required maxLength={254}
                readOnly={!emailEditable} onFocus={() => setEmailEditable(true)}
                value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
            </label>
            <label htmlFor="login-password">Password
              <input id="login-password" name="password" type="password" autoComplete={afterLogout ? 'off' : 'current-password'} placeholder="••••••••••••" required maxLength={1024}
                readOnly={!passwordEditable} onFocus={() => setPasswordEditable(true)}
                value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
            </label>
            <button className="login-link login-recovery" type="button" onClick={onForgotPassword}>Forgot password?</button>
          </div>
          <div className="login-actions">
            <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
            <div className="login-signup">New to FinClear? <button className="login-link" type="button" onClick={onCreateAccount || (() => setNotice('Account creation is not available yet. Please log in with an existing account.'))}>Create an account</button></div>
            <button className="login-google" type="button" disabled={busy} onClick={() => { setError(''); void startGoogle('login').catch(e => setError(e.message)); }}>
              <span className="login-google-icon"><img src={google} alt="" /></span>Continue with Google
            </button>
          </div>
          {error && <p className="login-error" role="alert">{error}</p>}
          {notice && <p className="login-notice" role="status">{notice}</p>}
        </form>
      </div>
    </main>
  );
}
