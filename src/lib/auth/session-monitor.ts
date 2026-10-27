import type { StoreApi } from 'zustand';
import type { AuthState } from '@/stores/authStore';
import { AUTH_FOCUS_THROTTLE } from './session-snapshot';

type SessionEvent = { at: number; kind: 'expire' | 'refresh' };
type AuthStore = Pick<StoreApi<AuthState>, 'getState' | 'subscribe'>;

export function nextSessionEvent(state: AuthState): SessionEvent | null {
  const expiry: SessionEvent | null =
    state.isAuthenticated && state.expiresAt ? { at: state.expiresAt, kind: 'expire' } : null;
  if (state.isRefreshing) return expiry;
  let checkAt = state.nextRetryAt;
  if (checkAt === null && state.retryCount === 0 && expiry) {
    const proactive = expiry.at - 15_000;
    if (proactive > (state.lastCheckedAt ?? 0)) checkAt = proactive;
  }
  if (checkAt === null || (expiry && expiry.at <= checkAt)) return expiry;
  return { at: checkAt, kind: 'refresh' };
}

export function startSessionMonitor(
  store: AuthStore,
  options: { isVisible: () => boolean; checkOnStart?: boolean },
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const schedule = () => {
    clearTimeout(timer);
    if (stopped || !options.isVisible()) return;
    const next = nextSessionEvent(store.getState());
    if (!next) return;
    timer = setTimeout(
      () => {
        if (stopped || !options.isVisible()) return;
        const due = nextSessionEvent(store.getState());
        if (due && due.at <= Date.now()) {
          if (due.kind === 'expire') store.getState().expireAuthState();
          else void store.getState().refreshAuthState();
        }
        schedule();
      },
      Math.min(2_147_000_000, Math.max(0, next.at - Date.now())),
    );
  };
  const unsubscribe = store.subscribe(schedule);
  const resume = () => {
    if (!options.isVisible()) {
      schedule();
      return;
    }
    store.getState().expireAuthState();
    const state = store.getState();
    if (
      !state.isRefreshing &&
      (state.lastCheckedAt === null || Date.now() - state.lastCheckedAt >= AUTH_FOCUS_THROTTLE)
    ) {
      void state.refreshAuthState({ resetRetries: true });
    }
    schedule();
  };
  schedule();
  if (options.checkOnStart !== false) resume();
  return {
    resume,
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
    },
  };
}
