import { useEffect, useRef, useState, type ComponentType } from 'react';
import { authRequest, readUser, type AuthUser } from './auth';
import Login from './Login';
import Signup from './Signup';
import ConnectBank from './ConnectBank';
import AccountRecovery from './AccountRecovery';

export default function AuthGate({ component: Component }: { component: ComponentType<{ user: AuthUser; logout: () => Promise<void> }> }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(() => {
    switch (window.location.hash) {
      case '#google-email-conflict':
        return 'An account alreadt exists with this email. Please log in using your password.';
      case '#google-error':
        return 'Google authentication failed. Please try again.';
      default:
        return '';
    }
  })
  const [link] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const [flow, setFlow] = useState<'forgot'|'verify'|'reset'|null>(()=>link.has('verify')?'verify':link.has('reset')?'reset':null);
  const [screen, setScreen] = useState<'login'|'signup'|'connect'>(()=> {
    if (window.location.hash === '#google-signup') {
      return 'signup';
    }
    if (window.location.hash === '#onboarding') {
      return 'connect';
    }
    return 'login';
  });
  const authVersion = useRef(0);
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null,'',window.location.pathname + window.location.search);
    let active = true;
    async function restore() {
      const version = authVersion.current;
      try {
        const response = await authRequest('me');
        if (response.status === 401) { if (active && version === authVersion.current) setUser(null); return; }
        const restored = await readUser(response);
        if (active && version === authVersion.current) setUser(restored);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to check your login.');
      } finally { if (active) setChecking(false); }
    }
    void restore();
    const interval = window.setInterval(() => void restore(), 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  async function logout() {
    const response = await authRequest('logout', {});
    if (!response.ok) throw new Error('Unable to log out. Please try again.');
    authVersion.current++;
    setUser(null);
    setError('');
    setScreen('login');
  }
  async function refresh() {
    const response = await authRequest('me');
    authVersion.current++;
    if (response.status===401) { setUser(null); return; }
    setUser(await readUser(response));
  }
  function closeFlow() { setFlow(null); setScreen('login'); void refresh().catch(e=>setError(e.message)); }
  if (checking) return <main className="login-page" role="status">Checking your login…</main>;
  if (flow) return <AccountRecovery key={flow} mode={flow} token={link.get(flow)||undefined} onBack={closeFlow} onVerified={refresh} logout={logout} />;
  if (user && !user.emailVerified) return <AccountRecovery mode='pending' user={user} onBack={closeFlow} onVerified={refresh} logout={logout} />;
  if (user && screen === 'connect') return <ConnectBank onContinue={() => setScreen('login')} />;
  if (!user && screen === 'signup') return <Signup onBack={() => setScreen('login')} onSubmit={async credentials => {
    const nextUser = await readUser(await authRequest('signup', credentials));
    authVersion.current++;
    setUser(nextUser);
    setScreen('connect');
  }} />;
  if (!user) return <Login onForgotPassword={()=>setFlow('forgot')} onCreateAccount={() => setScreen('signup')} onSubmit={async credentials => {
    const nextUser = await readUser(await authRequest('login', credentials));
    authVersion.current++;
    setUser(nextUser);
  }} initialError={error} />;
  return <Component key={user.id} user={user} logout={logout} />;
}
