export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'free' | 'trial' | 'premium';
  trialEndsAt: string | null;
  premiumEndsAt: string | null;
  emailVerified: boolean;
  permissions: { maxBudgetCategories: number | null; maxSavingsGoals: number | null; maxBankConnections: number | null; monthlyReports: boolean; businessAccounts: boolean };
};

export type SignupCredentials = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

export async function authRequest(path: string, body?: Record<string, unknown>) {
  try {
    return await fetch(`/api/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach FinClear. Please check your connection and try again.');
  }
}

export async function readUser(response: Response): Promise<AuthUser> {
  const data = await response.json().catch(() => ({ error: 'Sign-in is temporarily unavailable. Please try again.' }));
  if (!response.ok) throw new Error(data.error || 'Unable to sign in. Please try again.');
  if (!data.user || typeof data.user.id !== 'string' || typeof data.user.firstName !== 'string' ||
      !['free', 'trial', 'premium'].includes(data.user.role)) throw new Error('Unexpected authentication response.');
  return data.user;
}

export async function checkedRequest(path: string, body?: Record<string, unknown>) {
  const response = await authRequest(path, body);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed. Please try again.');
  }
  return response;
}
export async function startGoogle(mode: 'login' | 'signup', acceptedTerms = false) {
  const response = await checkedRequest('google/start', { mode, acceptedTerms });
  const { url } = await response.json();
  window.location.assign(url);
}
