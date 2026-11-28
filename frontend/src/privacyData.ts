import { budgetStorageKey } from './budgetState.ts';

export function accountStorageKeys(userId: string) {
  return [budgetStorageKey(userId), `finclear-settings:${userId}`];
}

export function browserAccountData(userId: string, storage: Pick<Storage, 'getItem'> = localStorage) {
  return Object.fromEntries(accountStorageKeys(userId).map(key => {
    const raw = storage.getItem(key);
    if (raw === null) return [key, null];
    try { return [key, { value: JSON.parse(raw) }]; }
    catch { return [key, { rawValue: raw }]; }
  }));
}

export function clearBrowserAccountData(userId: string, storage: Pick<Storage, 'removeItem'> = localStorage) {
  let complete = true;
  for (const key of accountStorageKeys(userId)) {
    try { storage.removeItem(key); } catch { complete = false; }
  }
  return complete;
}

export async function privacyRequest(path: 'export' | 'delete-account', body: {
  password: string; email?: string; confirmation?: string;
}, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(`/api/privacy/${path}`, {
      method: 'POST', credentials: 'same-origin', signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === 'AbortError') throw cause;
    throw new Error(path === 'delete-account'
      ? 'The deletion result could not be confirmed. Check your connection and try signing in again before retrying.'
      : 'Cannot reach FinClear. Please check your connection and try again.', { cause });
  }
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(typeof result?.error === 'string' ? result.error : 'Your privacy request could not be completed. Please try again.');
  }
  return response;
}

export function accountExport(serverData: unknown, userId: string, browserData: unknown) {
  if (!serverData || typeof serverData !== 'object') throw new Error('The account export response was invalid. Please try again.');
  const result = serverData as { schemaVersion?: unknown; exportedAt?: unknown; data?: { user?: { id?: unknown } } };
  if (result.schemaVersion !== 1 || typeof result.exportedAt !== 'string' || !Number.isFinite(Date.parse(result.exportedAt)) || result.data?.user?.id !== userId) {
    throw new Error('The account export did not match your signed-in account. Please sign in again.');
  }
  return JSON.stringify({ ...result, browserData: {
    description: 'Account-specific data saved in this browser. Device-wide appearance preferences and data from other browsers are not included.',
    records: browserData,
  } }, null, 2);
}
