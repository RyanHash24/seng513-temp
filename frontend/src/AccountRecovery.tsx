import { useState, type FormEvent } from 'react';
import { checkedRequest, type AuthUser } from './auth';
import AuthBrand from './AuthBrand';
import './Login.css';

export default function AccountRecovery({ mode, token, user, onBack, onVerified, logout }: {
  mode: 'forgot' | 'reset' | 'verify' | 'pending'; token?: string; user?: AuthUser;
  onBack: () => void; onVerified: () => Promise<void>; logout: () => Promise<void>;
}) {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [confirmation,setConfirmation] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [done,setDone] = useState(false);
  const titles = {forgot:'Recover your password',reset:'Set a new password',verify:'Verify your email',pending:'Check your email'};
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode==='forgot') { await checkedRequest('forgot-password',{email}); setNotice('If an account exists, a reset link will be sent.'); setDone(true); }
      if (mode==='reset') { await checkedRequest('reset-password',{token,password,confirmPassword:confirmation}); setNotice('Password updated. You can log in with your new password.'); setDone(true); }
      if (mode==='verify') { await checkedRequest('verify-email',{token}); await onVerified(); setNotice('Email verified. You can log in now.'); setDone(true); }
      if (mode==='pending') { await checkedRequest('resend-verification',{}); setNotice('A new verification link has been requested.'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.'); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><AuthBrand/><div className="login-layout"><section className="login-welcome"><h1>{titles[mode]}</h1><p>{mode==='pending' ? `Verify ${user?.email} before accessing your account. Open the email link, or request a new one below.` : 'Secure your FinClear account.'}</p></section>
    <form className="login-form" onSubmit={submit}>
      {mode==='forgot'&&!done&&<label>Email<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>}
      {mode==='reset'&&!done&&<><label>New password<input type="password" required minLength={7} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm password<input type="password" required minLength={7} maxLength={128} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><p>Use at least 7 characters and one special character.</p></>}
      {!done&&<button className="login-submit" disabled={busy}>{busy?'Please wait…':mode==='forgot'?'Send reset link':mode==='reset'?'Reset password':mode==='verify'?'Verify email':'Resend verification email'}</button>}
      {mode==='pending'?<><button type="button" className="login-link" onClick={()=>void onVerified().catch(e=>setError(e.message))}>I've verified my email</button><button type="button" className="login-link" onClick={()=>void logout().catch(e=>setError(e.message))}>Log out</button></>:<button type="button" className="login-link" onClick={onBack}>Back to login</button>}
      {error&&<p className="login-error" role="alert">{error}</p>}{notice&&<p className="login-notice" role="status">{notice}</p>}
    </form></div></main>;
}
