import { useEffect, useState } from 'react';
import { plaidStatus, type PlaidStatus } from './plaid';

export function usePlaidStatus(supplied?: PlaidStatus) {
  const [status, setStatus] = useState<PlaidStatus | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (supplied) return;
    const controller = new AbortController();
    void plaidStatus(controller.signal).then(value => {
      if (!controller.signal.aborted) setStatus(value);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load the bank configuration.');
    });
    return () => controller.abort();
  }, [supplied]);
  return { status: supplied || status, error };
}
