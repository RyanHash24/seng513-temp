import { useCallback, useEffect, useState } from 'react';
import { plaidRequest, type PlaidEnvironment } from './plaid';
import type { BudgetSpendingEntry } from './budgetSpendingData';

export function useBudgetSpending(environment: PlaidEnvironment | undefined, accountIds: string[], start: string, end: string) {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const ids = [...accountIds].sort().join(',');
  const key = environment && ids && start && end && start <= end ? `${environment}:${ids}:${start}:${end}:${revision}` : '';
  const [result, setResult] = useState<{ key: string; entries: BudgetSpendingEntry[]; error: string; loading: boolean }>({ key: '', entries: [], error: '', loading: false });
  useEffect(() => {
    if (!key || !environment) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ accountIds: ids, start, end });
    void plaidRequest<{ entries: BudgetSpendingEntry[] }>(`budget-spending?${query}`, environment, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setResult({ key, entries: data.entries, error: '', loading: false }); })
      .catch(cause => { if (!controller.signal.aborted) setResult({ key, entries: [], loading: false,
        error: cause instanceof Error ? cause.message : 'Unable to calculate spending.' }); });
    return () => controller.abort();
  }, [key, environment, ids, start, end]);
  if (!key) return { entries: [] as BudgetSpendingEntry[], error: '', loading: false, reload };
  return result.key === key ? { ...result, reload } : { entries: [] as BudgetSpendingEntry[], error: '', loading: true, reload };
}
