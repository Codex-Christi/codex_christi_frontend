import 'server-only';

type UnlockAttempt = {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
};

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const globalForAdminRateLimit = globalThis as typeof globalThis & {
  __codexChristiAdminUnlockAttempts?: Map<string, UnlockAttempt>;
};

const attempts =
  globalForAdminRateLimit.__codexChristiAdminUnlockAttempts ??
  new Map<string, UnlockAttempt>();

globalForAdminRateLimit.__codexChristiAdminUnlockAttempts = attempts;

export function getAdminUnlockRateLimit(userID: string) {
  const now = Date.now();
  const attempt = attempts.get(userID);

  if (!attempt) {
    return { locked: false, remainingAttempts: MAX_ATTEMPTS };
  }

  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    return {
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil((attempt.lockedUntil - now) / 1000),
    };
  }

  if (now - attempt.firstAttemptAt > WINDOW_MS) {
    attempts.delete(userID);
    return { locked: false, remainingAttempts: MAX_ATTEMPTS };
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempt.count),
  };
}

export function recordFailedAdminUnlock(userID: string) {
  const now = Date.now();
  const current = attempts.get(userID);
  const next =
    current && now - current.firstAttemptAt <= WINDOW_MS
      ? {
          ...current,
          count: current.count + 1,
        }
      : {
          count: 1,
          firstAttemptAt: now,
          lockedUntil: null,
        };

  if (next.count >= MAX_ATTEMPTS) {
    next.lockedUntil = now + LOCK_MS;
  }

  attempts.set(userID, next);

  return getAdminUnlockRateLimit(userID);
}

export function clearAdminUnlockAttempts(userID: string) {
  attempts.delete(userID);
}

