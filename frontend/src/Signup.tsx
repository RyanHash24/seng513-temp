import { useState, type FormEvent } from 'react';
import '@fontsource-variable/inter';
import AuthBrand from './AuthBrand';
import AuthPolicy from './AuthPolicy';
import { startGoogle, type SignupCredentials } from './auth';
import google from './assets/auth/google.svg';
import './Login.css';
import './Signup.css';
import { useAuthTheme } from './useAuthTheme';

function focusSignupError(element: HTMLParagraphElement | null) {
  element?.focus();
}

export default function Signup({ onSubmit, onBack }: { onSubmit: (credentials: SignupCredentials) => Promise<void>; onBack: () => void }) {
  const theme = useAuthTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [policy, setPolicy] = useState<'privacy' | 'terms' | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(''); setNotice('');
    if (password.length < 7 || password.length > 128 || !/[\p{P}\p{S}]/u.test(password)) {
      setError('Use 7–128 characters, including at least one special character.'); return;
    }
    if (password !== confirmation) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await onSubmit({ fullName, email, password, confirmPassword: confirmation, acceptedTerms });
      setPassword(''); setConfirmation('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create your account. Please try again.');
    } finally { setBusy(false); }
  }

  if (policy) return <AuthPolicy policy={policy} theme={theme} onBack={() => setPolicy(null)} />;
  return <main className="login-page signup-page" data-theme={theme}>
    <AuthBrand />
    <header className="signup-mobile-heading">
      <button type="button" className="login-link" onClick={onBack} disabled={busy}>Back</button>
      <span>FinClear · Step 1 of 2</span>
    </header>
    <div className="login-layout signup-layout">
      <section className="signup-introduction" aria-labelledby="signup-heading">
        <div className="signup-progress-heading"><button type="button" className="login-link" onClick={onBack} disabled={busy}>← Back</button><span>Step 1 of 2</span></div>
        <div className="signup-progress" role="progressbar" aria-label="Account setup" aria-valuenow={1} aria-valuemin={0} aria-valuemax={2}><span /><span /></div>
        <h1 id="signup-heading">Create your account</h1><p>Please fill out the information.</p>
      </section>
      <form className="login-form signup-form" onSubmit={submit} aria-label="Create account" aria-busy={busy}>
        {error && <p id="signup-error" className="login-error signup-form-error" role="alert" tabIndex={-1} ref={focusSignupError}>{error}</p>}
        <label htmlFor="signup-name">Full name<input id="signup-name" name="name" autoComplete="name" placeholder="Your full name" required maxLength={200} value={fullName} onChange={event => setFullName(event.target.value)} disabled={busy} /></label>
        <label htmlFor="signup-email">Email<input id="signup-email" name="email" type="email" autoComplete="username" placeholder="you@example.com" required maxLength={254} value={email} onChange={event => { setEmail(event.target.value); setError(''); }} disabled={busy} /></label>
        <label htmlFor="signup-password">Password<input id="signup-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••••••••" required minLength={7} maxLength={128} aria-describedby="signup-password-help" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></label>
        <label htmlFor="signup-confirmation">Confirm password<input id="signup-confirmation" name="confirmPassword" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••••••••" required minLength={7} maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>
        <div className="signup-password-guidance"><span id="signup-password-help">Use at least 7 characters and include at least one special character.</span><button type="button" className="login-link" aria-pressed={showPassword} aria-controls="signup-password signup-confirmation" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide password' : 'Show password'}</button></div>
        <label className="signup-consent"><input type="checkbox" required checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} disabled={busy} /><span>I agree to the Terms of Service and acknowledge the Privacy Policy.</span></label>
        <div className="signup-legal"><button className="login-link" type="button" onClick={() => setPolicy('privacy')}>Privacy Policy</button><button className="login-link" type="button" onClick={() => setPolicy('terms')}>Terms of Service</button></div>
        <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Continue'}</button>
        <button className="login-google" type="button" disabled={busy} onClick={() => { setError(''); if (!acceptedTerms) { setError('Please accept the terms first.'); return; } void startGoogle('signup', true).catch(e => setError(e.message)); }}><span className="login-google-icon"><img src={google} alt="" /></span>Sign up with Google</button>
        <button className="login-link signup-back" type="button" onClick={onBack} disabled={busy}>Already have an account? Log in</button>
        {notice && <p className="login-notice" role="status">{notice}</p>}
      </form>
    </div>
  </main>;
}
