import { createHash } from 'node:crypto';
import { resolveServerDjangoApiBaseUrl } from '../django/resolveServerDjangoApiBaseUrl';
import { asRecord, getNestedAuthToken } from './django-auth-response';
import { readDjangoJson } from '../django/request';

export interface RefreshedDjangoTokens {
  accessToken: string;
  refreshToken: string;
}

export class SessionRefreshError extends Error {
  constructor(public invalid: boolean) {
    super(
      invalid
        ? 'Your session expired. Sign in again.'
        : 'Sign-in is temporarily unavailable. Please try again.',
    );
    this.name = 'SessionRefreshError';
  }
}

type RefreshEntry = {
  promise?: Promise<RefreshedDjangoTokens>;
  expires: number;
  cancelled: boolean;
};
const refreshes = new Map<string, RefreshEntry>();
const tokenKey = (token: string) => createHash('sha256').update(token).digest('hex');

export function cancelSessionRefresh(token: string) {
  const key = tokenKey(token);
  const entry = refreshes.get(key);
  if (entry) {
    entry.cancelled = true;
    entry.expires = Date.now() + 30_000;
  } else if (refreshes.size < 128)
    refreshes.set(key, {
      cancelled: true,
      expires: Date.now() + 30_000,
    });
}

export function assertSessionRefreshActive(token: string) {
  if (refreshes.get(tokenKey(token))?.cancelled) throw new SessionRefreshError(true);
}

async function requestRefresh(token: string): Promise<RefreshedDjangoTokens> {
  const path = process.env.DJANGO_AUTH_REFRESH_PATH?.trim() || '/auth/token/refresh';
  if (!path.startsWith('/') || path.startsWith('//') || /[\\?#\r\n]/.test(path))
    throw new SessionRefreshError(false);
  try {
    const response = await fetch(`${resolveServerDjangoApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh: token }),
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    const payload: unknown = await readDjangoJson(response).catch(() => null);
    if (!response.ok) {
      const invalid =
        response.status === 401 ||
        (response.status === 400 && asRecord(payload)?.code === 'token_not_valid');
      throw new SessionRefreshError(invalid);
    }
    const accessToken = getNestedAuthToken(payload, 'access');
    if (!accessToken) throw new SessionRefreshError(false);
    return { accessToken, refreshToken: getNestedAuthToken(payload, 'refresh') ?? token };
  } catch (error) {
    if (error instanceof SessionRefreshError) throw error;
    throw new SessionRefreshError(false);
  }
}

// Coalesce only within this process; a short success window handles parallel old-cookie requests.
export async function refreshDjangoSessionTokens(token: string) {
  const now = Date.now();
  for (const [key, entry] of refreshes) if (entry.expires <= now) refreshes.delete(key);
  const key = tokenKey(token);
  const existing = refreshes.get(key);
  if (existing?.cancelled) throw new SessionRefreshError(true);
  if (existing?.promise) return existing.promise;
  if (refreshes.size >= 128) throw new SessionRefreshError(false);
  const promise = requestRefresh(token)
    .then((result) => {
      assertSessionRefreshActive(token);
      entry.expires = Date.now() + 2000;
      return result;
    })
    .catch((error) => {
      if (!entry.cancelled) refreshes.delete(key);
      throw error;
    });
  const entry: RefreshEntry = { promise, expires: now + 10_000, cancelled: false };
  refreshes.set(key, entry);
  return promise;
}
