import { useCallback, useEffect, useState } from 'react';
import { budgetStorageKey, loadBudgetPlan, type BudgetPlan } from './budgetState';
import type { PlaidEnvironment } from './plaid';

export type BudgetVersion = { revision: number; environment: PlaidEnvironment };
type Snapshot = BudgetVersion & { plan: BudgetPlan | null };

async function requestPlan(userId: string, options: RequestInit = {}): Promise<Snapshot> {
  const response = await fetch('/api/budget-plan', {
    ...options, cache: 'no-store', credentials: 'same-origin',
    headers: { Accept: 'application/json', 'X-FinClear-User': userId,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || !['sandbox', 'production'].includes(data.environment) ||
    !Number.isSafeInteger(data.revision) || (data.revision === 0 ? data.plan !== null : !data.plan))
    throw Object.assign(new Error(data?.error || 'Your budget could not be confirmed. Please try again.'), { status: response.status });
  return data;
}

// Workspace is keyed by signed-in user. Budget and Overview share this snapshot.
export function useBudgetPlan(userId: string, visible: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [legacy, setLegacy] = useState(() => loadBudgetPlan(userId));
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(value => value + 1), []);
  const accept = useCallback((next: Snapshot) => {
    setSnapshot(current => current && current.environment === next.environment && current.revision > next.revision ? current : next);
    setError('');
  }, []);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let busy = false;
    async function refresh() {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const next = await requestPlan(userId, { signal: controller.signal });
        if (!controller.signal.aborted) accept(next);
      } catch (cause) {
        if (!controller.signal.aborted) {
          if (cause instanceof Error && 'status' in cause && [401, 403, 409].includes(Number(cause.status))) setSnapshot(null);
          setError(cause instanceof Error ? cause.message : 'Unable to refresh your budget.');
        }
      } finally { busy = false; }
    }
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [accept, attempt, userId, visible]);

  async function save(plan: BudgetPlan, base: BudgetVersion, imported: boolean) {
    let next: Snapshot;
    try {
      next = await requestPlan(userId, { method: 'PUT', body: JSON.stringify({
        environment: base.environment, revision: base.revision, plan,
      }) });
    } catch (cause) {
      reload();
      throw cause;
    }
    accept(next);
    if (imported && legacy) {
      // Only retire the exact browser copy reviewed after the server acknowledges it.
      try {
        if (JSON.stringify(loadBudgetPlan(userId)) === JSON.stringify(legacy))
          localStorage.removeItem(budgetStorageKey(userId));
      } catch { /* The server copy is already durable when browser storage is unavailable. */ }
      setLegacy(null);
    }
  }
  return { snapshot, legacy, error, reload, save };
}
export type SavedBudget = ReturnType<typeof useBudgetPlan>;
