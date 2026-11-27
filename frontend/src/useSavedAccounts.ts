import { useCallback, useEffect, useState } from 'react';
import { plaidRequest, plaidStatus, type LinkedAccount, type PlaidStatus } from './plaid';

export function useSavedAccounts() {
  const [data, setData] = useState<{
    accounts: LinkedAccount[]; status: PlaidStatus | null; loading: boolean; error: string;
  }>({ accounts: [], status: null, loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setData(previous => ({ ...previous, loading: true, error: '' }));
      try {
        const status = await plaidStatus(controller.signal);
        if (!status.configured) {
          if (!controller.signal.aborted) setData({ accounts: [], status, loading: false,
            error: 'Bank connections are not enabled for this environment.' });
          return;
        }
        const result = await plaidRequest<{ accounts: LinkedAccount[] }>('accounts', status.environment,
          { signal: controller.signal });
        if (!controller.signal.aborted) setData({ accounts: result.accounts, status, loading: false, error: '' });
      } catch (cause) {
        if (!controller.signal.aborted) setData(previous => ({ ...previous, loading: false,
          error: cause instanceof Error ? cause.message : 'Unable to load your accounts. Please try again.' }));
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);
  return { ...data, reload };
}
