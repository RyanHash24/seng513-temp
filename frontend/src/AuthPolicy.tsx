import { useEffect, useRef } from 'react';

const sections = {
  privacy: [
    ['Information used', "FinClear's proposed service uses the account details you provide and the balances, transactions and account identifiers you choose to connect."],
    ['Why it is used', 'This information supports your account views, categories, budgets and requested reports. Optional connections can be managed in Settings.'],
    ['Third-party connections', "Plaid is shown as the proposed account-linking provider. Review the provider's permissions when choosing which accounts to share."],
    ['Your controls', 'The interface includes connection management, data export and account-deletion requests. Disconnecting an account is separate from deleting your FinClear profile.'],
    ['Before publication', 'The final notice must identify the operator, privacy contact, actual service providers, retention periods and applicable rights. This draft must be reviewed against the implemented service.'],
  ],
  terms: [
    ['Using FinClear', 'FinClear is designed to help you view accounts, organise transactions and plan a budget. The current file demonstrates these workflows with sample data.'],
    ['Your account', 'Provide accurate account information and protect your sign-in details. Review the accounts and permissions you authorise when linking a financial institution.'],
    ['Budgets and reports', "Balances, transaction categories and reports should be reviewed before you rely on them. A financial-management interface does not replace your financial institution's records."],
    ['Connections and subscriptions', 'A third-party connection can require renewed authorisation. Any paid plan should show pricing, renewal and cancellation terms before purchase.'],
    ['Before publication', 'The operator, support contact, applicable law, billing terms and account-closure conditions must be finalised and reviewed before this draft is published.'],
  ],
};

export default function AuthPolicy({ policy, onBack, theme }: { policy: 'privacy' | 'terms'; onBack: () => void; theme?: 'light' | 'dark' }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const title = policy === 'privacy' ? 'Privacy policy' : 'Terms of Service';
  return <main className="login-page auth-policy" data-theme={theme}>
    <header><button className="login-link" onClick={onBack}>Back</button><span>{title}</span></header>
    <article>
      <p className="auth-policy-draft">DRAFT · FOR REVIEW BEFORE LAUNCH</p>
      <h1 ref={heading} tabIndex={-1}>{title}</h1>
      <p>Proposed product policy for this prototype. Final wording must match the live service.</p>
      {sections[policy].map(([label, text]) => <section key={label}><h2>{label}</h2><p>{text}</p></section>)}
      <button className="onboarding-secondary" onClick={onBack}>Back to previous screen</button>
    </article>
  </main>;
}
