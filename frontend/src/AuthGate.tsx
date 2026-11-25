import { useEffect, useRef, useState, type ComponentType } from 'react';
import { authRequest, readUser, type AuthUser } from './auth';
import Login from './Login';
import Signup from './Signup';
import ConnectBank from './ConnectBank';

export default function AuthGate({ component: Component }: { component: ComponentType<{ user: AuthUser; logout: () => Promise<void> }> }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<'login' | 'signup' | 'connect'>('login');
  const authVersion = useRef(0);
  useEffect(() => {
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
  if (checking) return <main className="login-page" role="status">Checking your login…</main>;
  if (user && screen === 'connect') return <ConnectBank onContinue={() => setScreen('login')} />;
  if (!user && screen === 'signup') return <Signup onBack={() => setScreen('login')} onSubmit={async credentials => {
    const nextUser = await readUser(await authRequest('signup', credentials));
    authVersion.current++;
    setUser(nextUser);
    setScreen('connect');
  }} />;
  if (!user) return <Login onCreateAccount={() => setScreen('signup')} onSubmit={async credentials => {
    const nextUser = await readUser(await authRequest('login', credentials));
    authVersion.current++;
    setUser(nextUser);
  }} initialError={error} />;
  return <Component user={user} logout={logout} />;
}
