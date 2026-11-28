import { useCallback, useEffect, useState } from 'react';
import { plaidRequest, type PlaidStatus } from './plaid';
import {
  loadActivityPeriod,
  type ActivityPage,
  type ActivityTransaction,
  type ActivityPeriod,
} from './activityData';

export function useActivityTransactions(
  userId: string,
  status: PlaidStatus | null,
  period: ActivityPeriod,
) {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  const key = [
    userId,
    status?.environment,
    status?.configured,
    period.start,
    period.end,
    revision,
  ].join(':');
  const [result, setResult] = useState<{
    key: string;
    transactions: ActivityTransaction[];
    loading: boolean;
    error: string;
    loadedAt: string;
  }>({ key: '', transactions: [], loading: true, error: '', loadedAt: '' });
  const environment = status?.environment;
  const configured = status?.configured;
  useEffect(() => {
    if (!configured || !environment) return;
    const controller = new AbortController();
    async function load() {
      setResult({ key, transactions: [], loading: true, error: '', loadedAt: '' });
      try {
        const transactions = await loadActivityPeriod(
          { start: period.start, end: period.end },
          (cursor) => {
            const query = cursor
              ? '?' + new URLSearchParams({ beforeDate: cursor.date, beforeId: cursor.id })
              : '';
            return plaidRequest<ActivityPage>('transactions' + query, environment!, {
              signal: controller.signal,
            });
          },
        );
        if (!controller.signal.aborted)
          setResult({
            key,
            transactions,
            loading: false,
            error: '',
            loadedAt: new Date().toISOString(),
          });
      } catch (cause) {
        if (!controller.signal.aborted)
          setResult({
            key,
            transactions: [],
            loading: false,
            error: cause instanceof Error ? cause.message : 'Unable to load bank transactions.',
            loadedAt: '',
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, configured, environment, period.start, period.end]);
  return result.key === key
    ? { ...result, reload }
    : { transactions: [], loading: true, error: '', loadedAt: '', reload };
}
