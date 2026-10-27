import { createHash } from 'node:crypto';
import { resolveServerDjangoApiBaseUrl } from '../django/resolveServerDjangoApiBaseUrl';
import { asRecord, getNestedAuthToken } from './django-auth-response';
import { readDjangoJson } from '../django/request';
import { getDjangoAuthRefreshPath } from './session-config';

export interface RefreshedDjangoTokens {
  accessToken: string;
  refreshToken: string;
}

class RefreshError extends Error {
  constructor(public invalid: boolean) {
    super(
      invalid
        ? 'Your session expired. Sign in again.'
        : 'Sign-in is temporarily unavailable. Please try again.',
    );
    this.name = 'SessionRefreshError';
  }
}

type RefreshFamily = {
  entries: Set<RefreshEntry>;
  expires: number;
  cancelled: boolean;
};
type RefreshEntry = {
  family: RefreshFamily;
  generation: number;
  promise?: Promise<RefreshedDjangoTokens>;
  reusableUntil: number;
  pending: boolean;
};
const RETENTION_MS = 30_000;
const MAX_TRACKED_TOKENS = 256;
type RefreshState = {
  Error: typeof RefreshError;
  refreshes: Map<string, RefreshEntry>;
  resultEntries: WeakMap<RefreshedDjangoTokens, RefreshEntry>;
  generation: number;
  retryAfter: number;
  reservedAliases: number;
};
// Next bundles Proxy and handlers separately; share cancellation within this Node process.
const stateKey = Symbol.for('codexchristi.session-refresh.v1');
const shared = globalThis as typeof globalThis & { [stateKey]?: RefreshState };
const state = (shared[stateKey] ??= {
  Error: RefreshError,
  refreshes: new Map(),
  resultEntries: new WeakMap(),
  generation: 0,
  retryAfter: 0,
  reservedAliases: 0,
});
export const SessionRefreshError = state.Error;
const { refreshes, resultEntries } = state;
const tokenKey = (token: string) => createHash('sha256').update(token).digest('hex');

function pruneRefreshes(now: number) {
  const pendingFamilies = new Set<RefreshFamily>();
  for (const entry of refreshes.values()) if (entry.pending) pendingFamilies.add(entry.family);
  for (const [key, entry] of refreshes) {
    if (!entry.pending && entry.reusableUntil <= now) entry.promise = undefined;
    if (entry.family.expires <= now && !pendingFamilies.has(entry.family)) {
      refreshes.delete(key);
      entry.family.entries.delete(entry);
    }
  }
}

function trackToken(key: string, family?: RefreshFamily): RefreshEntry {
  const entry: RefreshEntry = {
    family: family ?? { entries: new Set(), cancelled: false, expires: Date.now() + RETENTION_MS },
    generation: state.generation,
    reusableUntil: 0,
    pending: false,
  };
  entry.family.entries.add(entry);
  refreshes.set(key, entry);
  return entry;
}

function pauseRefreshes() {
  // Never silently drop a cancellation when the bounded tracking map is full.
  state.generation++;
  state.retryAfter = Date.now() + RETENTION_MS;
}

function linkRotatedToken(entry: RefreshEntry, token: string) {
  const key = tokenKey(token);
  let related = refreshes.get(key);
  if (!related) {
    if (refreshes.size >= MAX_TRACKED_TOKENS) {
      pauseRefreshes();
      throw new SessionRefreshError(false);
    }
    related = trackToken(key, entry.family);
  }
  const family = entry.family;
  if (related.family !== family) {
    const previous = related.family;
    family.cancelled ||= previous.cancelled;
    family.expires = Math.max(family.expires, previous.expires);
    for (const member of previous.entries) {
      member.family = family;
      family.entries.add(member);
    }
    previous.entries.clear();
  }
}

function assertEntryActive(entry: RefreshEntry) {
  if (entry.family.cancelled) throw new SessionRefreshError(true);
  const now = Date.now();
  if (
    entry.family.expires <= now ||
    entry.generation !== state.generation ||
    now < state.retryAfter
  )
    throw new SessionRefreshError(false);
}

export function cancelSessionRefresh(token: string) {
  const now = Date.now();
  pruneRefreshes(now);
  const key = tokenKey(token);
  let entry = refreshes.get(key);
  if (!entry) {
    if (refreshes.size + state.reservedAliases >= MAX_TRACKED_TOKENS) {
      pauseRefreshes();
      return;
    }
    entry = trackToken(key);
  }
  entry.family.cancelled = true;
  entry.family.expires = now + RETENTION_MS;
}

export function assertSessionRefreshActive(token: string, result?: RefreshedDjangoTokens) {
  const entry = refreshes.get(tokenKey(token));
  if (entry) assertEntryActive(entry);
  const resultEntry = result && resultEntries.get(result);
  if (result && !resultEntry) throw new SessionRefreshError(false);
  if (resultEntry) assertEntryActive(resultEntry);
  if (Date.now() < state.retryAfter) throw new SessionRefreshError(false);
}

async function requestRefresh(token: string): Promise<RefreshedDjangoTokens> {
  try {
    const path = getDjangoAuthRefreshPath();
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
  pruneRefreshes(now);
  if (now < state.retryAfter) throw new SessionRefreshError(false);
  const key = tokenKey(token);
  let entry = refreshes.get(key);
  if (entry) {
    assertEntryActive(entry);
    if (entry.promise) return entry.promise;
  }
  // Reserve room for the rotated token before sending a request that may invalidate the old one.
  if (refreshes.size + state.reservedAliases + (entry ? 1 : 2) > MAX_TRACKED_TOKENS)
    throw new SessionRefreshError(false);
  entry ??= trackToken(key);
  const active = entry;
  active.pending = true;
  state.reservedAliases++;
  active.family.expires = now + RETENTION_MS;
  const promise = requestRefresh(token)
    .then((result) => {
      linkRotatedToken(active, result.refreshToken);
      assertEntryActive(active);
      active.family.expires = Date.now() + RETENTION_MS;
      active.reusableUntil = Date.now() + 2000;
      resultEntries.set(result, active);
      return result;
    })
    .catch((error) => {
      active.promise = undefined;
      throw error;
    })
    .finally(() => {
      active.pending = false;
      state.reservedAliases--;
    });
  active.promise = promise;
  return promise;
}
