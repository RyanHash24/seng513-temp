export type SecurityDetails = { email: string; signInMethod: 'password'; passwordChangedAt: string | null; sessionLifetimeMinutes: number };

export function passwordValidation(current: string, password: string, confirmation: string) {
  if (!current || current.length > 1024) return 'Enter your current password.';
  if (password.length < 7 || password.length > 128 || !/[\p{P}\p{S}]/u.test(password)) return 'Use 7–128 characters, including at least one special character.';
  if (password !== confirmation) return 'New passwords do not match.';
  if (current === password) return 'Choose a password different from your current password.';
  return '';
}

export function securityDetails(value: unknown): SecurityDetails {
  const data = value as Partial<SecurityDetails> | null;
  if (!data || typeof data.email !== 'string' || !data.email || data.signInMethod !== 'password' ||
    !Number.isSafeInteger(data.sessionLifetimeMinutes) || data.sessionLifetimeMinutes! <= 0 ||
    !(data.passwordChangedAt === null || typeof data.passwordChangedAt === 'string' && Number.isFinite(Date.parse(data.passwordChangedAt)))) {
    throw new Error('Your security details could not be read. Please try again.');
  }
  return data as SecurityDetails;
}

export function passwordChangeResult(value: unknown) {
  const data = value as { passwordChangedAt?: unknown; otherSessionsSignedOut?: unknown } | null;
  if (!data || data.otherSessionsSignedOut !== true || typeof data.passwordChangedAt !== 'string' || !Number.isFinite(Date.parse(data.passwordChangedAt))) {
    throw new Error('The password change could not be confirmed. Please sign in again to check your account.');
  }
  return data.passwordChangedAt;
}

export async function securityRequest(path: '' | 'password' | 'signout-all', body?: {
  currentPassword: string; newPassword?: string; confirmPassword?: string;
}, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(`/api/security${path ? `/${path}` : ''}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new Error(path === 'password'
      ? 'The password change could not be confirmed. Check your connection; if signed out, try signing in with your new password.'
      : path === 'signout-all' ? 'Sign-out could not be confirmed. Check your connection and try signing in again.'
      : 'Cannot load your security details. Check your connection and try again.', { cause });
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(typeof data?.error === 'string' ? data.error : 'Your security request could not be completed. Please try again.');
  }
  return response;
}
