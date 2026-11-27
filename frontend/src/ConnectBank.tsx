import { useState } from 'react';
import AuthBrand from './AuthBrand';
import AuthPolicy from './AuthPolicy';
import './Signup.css';

const benefits = [
  ['Choose the accounts you share', 'Select your bank and the accounts you want to link.'],
  ['Bring your activity into your budget', 'See balances and transactions together in FinClear.'],
  ['Keep control of your connection', 'Manage linked accounts and access in Settings.'],
];

export default function ConnectBank({ onContinue }: { onContinue: () => void }) {
  const [notice, setNotice] = useState('');
  const [policy, setPolicy] = useState<'privacy' | 'terms' | null>(null);
  if (policy) return <AuthPolicy policy={policy} onBack={() => setPolicy(null)} />;
  return <main className="login-page onboarding-page">
    <header><AuthBrand /><span>Create your account</span></header>
    <div className="onboarding-layout">
      <section className="signup-introduction" aria-labelledby="connect-heading">
        <div className="signup-progress-heading"><button className="login-link" onClick={onContinue}>← Back</button><span>Step 2 of 2</span></div>
        <div className="signup-progress" role="progressbar" aria-label="Account setup" aria-valuenow={2} aria-valuemin={0} aria-valuemax={2}><span /><span /></div>
        <h1 id="connect-heading">Connect your bank</h1>
        <p>Bring your balances and transactions together so your budget starts with a clearer picture.</p>
        <div className="onboarding-benefits">{benefits.map(([heading, text], index) => <div key={heading}><span>{index + 1}</span><div><strong>{heading}</strong><p>{text}</p></div></div>)}</div>
      </section>
      <section className="onboarding-choices" aria-label="Connection options">
        <div className="onboarding-card recommended">
          <div className="onboarding-recommendation">Plaid<span>Recommended</span></div>
          <h2>Connect with Plaid</h2><p>Automatically bring bank balances and transactions into FinClear.</p>
          <div className="onboarding-guidance">You choose which accounts to share.<p>Review access before completing the connection.</p></div>
          <button className="onboarding-primary" onClick={() => setNotice('Bank linking is not available yet. You can skip this step and connect later.')}>Connect with Plaid</button>
        </div>
        <div className="onboarding-card"><h3>Prefer to add an account yourself?</h3><p>Track cash or an account you want to update manually.</p><button className="onboarding-secondary" onClick={() => setNotice('Manual account setup is not available yet. You can skip this step for now.')}>Add an account manually</button></div>
        <button className="login-link onboarding-skip" onClick={onContinue}>Skip for now</button><p>You can connect an account later in Settings.</p>
        {notice && <p className="login-notice" role="status">{notice}</p>}
      </section>
    </div>
    <footer><p>By continuing you agree to the Terms and Privacy Policy.</p><div className="signup-legal"><button className="login-link" onClick={() => setPolicy('privacy')}>Privacy Policy</button><button className="login-link" onClick={() => setPolicy('terms')}>Terms of Service</button></div></footer>
  </main>;
}
