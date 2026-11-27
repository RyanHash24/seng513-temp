export type PlaidEnvironment = 'sandbox' | 'production';
export type PlaidStatus = { environment: PlaidEnvironment; configured: boolean };
export type LinkedAccount = {
  id: string; name: string; mask: string | null; currency: string;
  accountType: string; connectionId: string; connectionStatus: string;
  currentBalance: string | null; availableBalance: string | null;
  balanceUpdatedAt: string | null; institution: string;
};
export type PlaidConnection = { id: string; institution: string; status: string;
  lastSyncedAt: string | null; transactionsSyncedAt: string | null; transactionsUpdateStatus: string | null;
  investmentsSyncedAt: string | null; investmentsStatus: string | null;
  hasInvestmentAccounts: boolean; hasTransactionAccounts: boolean };

export async function plaidStatus(signal?: AbortSignal): Promise<PlaidStatus> {
  const response = await fetch('/api/plaid/status', { credentials: 'same-origin', signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Unable to load the bank configuration.');
  if (!['sandbox', 'production'].includes(data.environment) || typeof data.configured !== 'boolean') {
    throw new Error('The bank environment is not configured correctly.');
  }
  return data;
}

export async function plaidRequest<T>(path: string, environment: PlaidEnvironment,
  options: { body?: object; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(`/api/plaid/${path}`, { credentials: 'same-origin', signal: options.signal,
    method: options.body === undefined ? 'GET' : 'POST',
    headers: { 'X-Plaid-Environment': environment, ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const data = await response.json().catch(() => null);
  if (response.headers.get('X-Plaid-Environment') !== environment) {
    throw new Error('The bank environment changed. Reload this page before continuing.');
  }
  if (!data) throw new Error('The backend is unavailable. Please try again shortly.');
  if (!response.ok) throw Object.assign(new Error(data.error || 'Unable to complete the bank request.'), { connectionId: data.connectionId });
  return data;
}
