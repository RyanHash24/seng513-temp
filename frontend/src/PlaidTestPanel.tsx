import { useState } from 'react';
import BankTransactions from './BankTransactions';
import LinkedAccounts from './LinkedAccounts';
import './Transactions.css';
import './PlaidTestPanel.css';

export default function PlaidTestPanel() {
  const [accountsVersion, setAccountsVersion] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  return <div className="plaid-test-panel">
    <p className="plaid-test-note">Connection testing: link an account, sync its activity, then review the imported records below.</p>
    <LinkedAccounts key={`accounts-${accountsVersion}`} onChanged={() => setHistoryVersion(value => value + 1)} />
    <BankTransactions key={`history-${historyVersion}`} onChanged={() => setAccountsVersion(value => value + 1)} />
  </div>;
}
