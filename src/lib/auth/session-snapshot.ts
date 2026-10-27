export interface AuthSessionState {
  isAuthenticated: boolean;
  user_id: string | null;
  expiresAt?: number | null;
  status?: 'authenticated' | 'anonymous' | 'unavailable';
  retryable?: boolean;
}

export const AUTH_RETRY_DELAYS = [2_000, 5_000, 15_000] as const;
export const AUTH_FOCUS_THROTTLE = 15_000;

export function isFreshServerSession(session: AuthSessionState | undefined, now = Date.now()) {
  return Boolean(
    session?.isAuthenticated &&
    session.user_id &&
    typeof session.expiresAt === 'number' &&
    Number.isFinite(session.expiresAt) &&
    session.expiresAt > now,
  );
}

export function isBootstrappedAccountPath(path: string) {
  return ['/profile', '/shop/account-overview', '/account-overview'].some(
    (base) => path === base || path.startsWith(`${base}/`),
  );
}
