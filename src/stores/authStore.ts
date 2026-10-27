import { create } from 'zustand';
import { getAuthSessionState } from '@/actions/login';
import {
  AUTH_RETRY_DELAYS,
  isFreshServerSession,
  type AuthSessionState,
} from '@/lib/auth/session-snapshot';
import { advanceAuthGeneration, getAuthGeneration } from '@/lib/auth/session-generation';

export interface AuthState {
  refreshAuthState: (options?: { resetRetries?: boolean }) => Promise<AuthSessionState>;
  seedServerSession: (session: AuthSessionState) => void;
  expireAuthState: () => void;
  isAuthenticated: boolean;
  status: 'unknown' | 'authenticated' | 'anonymous' | 'unavailable';
  expiresAt: number | null;
  accountOwnerId: string | null;
  lastCheckedAt: number | null;
  retryCount: number;
  nextRetryAt: number | null;
  isRefreshing: boolean;
  setSessionState: (session: AuthSessionState) => void;
  userSessionInfo: { user_id: string } | null;
}

export function createAuthStore(checkSession = getAuthSessionState) {
  let pending: { generation: number; promise: Promise<AuthSessionState> } | null = null;
  return create<AuthState>((set, get) => ({
    isAuthenticated: false,
    userSessionInfo: null,
    status: 'unknown',
    expiresAt: null,
    accountOwnerId: null,
    lastCheckedAt: null,
    retryCount: 0,
    nextRetryAt: null,
    isRefreshing: false,
    setSessionState: (session) => {
      const now = Date.now();
      const current = get();
      const expired =
        session.isAuthenticated &&
        typeof session.expiresAt === 'number' &&
        (!Number.isFinite(session.expiresAt) || session.expiresAt <= now);
      const unavailable = session.status === 'unavailable' || expired;
      const authenticated = !unavailable && session.isAuthenticated && Boolean(session.user_id);
      const id = authenticated ? session.user_id : null;
      const ownerId = unavailable ? current.accountOwnerId : id;
      const status = unavailable ? 'unavailable' : authenticated ? 'authenticated' : 'anonymous';
      if (
        ownerId !== current.accountOwnerId ||
        (status === 'anonymous' && current.status !== 'anonymous')
      )
        advanceAuthGeneration();
      const retryCount = unavailable || session.retryable ? current.retryCount + 1 : 0;
      const delay = AUTH_RETRY_DELAYS[retryCount - 1];
      set({
        isAuthenticated: authenticated,
        userSessionInfo: id ? { user_id: id } : null,
        accountOwnerId: ownerId,
        status,
        expiresAt: unavailable ? current.expiresAt : (session.expiresAt ?? null),
        lastCheckedAt: now,
        retryCount,
        nextRetryAt: delay === undefined ? null : now + delay,
      });
    },
    seedServerSession: (session) => {
      // Never overwrite a login/logout decision with an old prefetched layout.
      if (get().status !== 'unknown') return;
      if (isFreshServerSession(session)) get().setSessionState(session);
      else
        get().setSessionState({
          isAuthenticated: false,
          user_id: null,
          status: session.isAuthenticated ? 'unavailable' : (session.status ?? 'anonymous'),
        });
    },
    expireAuthState: () => {
      const state = get();
      if (!state.isAuthenticated || !state.expiresAt || state.expiresAt > Date.now()) return;
      set({
        isAuthenticated: false,
        userSessionInfo: null,
        status: 'unavailable',
        nextRetryAt: state.retryCount === 0 && !state.isRefreshing ? Date.now() : state.nextRetryAt,
      });
    },
    refreshAuthState: (options = {}) => {
      const generation = getAuthGeneration();
      if (pending?.generation === generation) return pending.promise;
      if (options.resetRetries) set({ retryCount: 0, nextRetryAt: null });
      set({ isRefreshing: true });
      const promise = (async () => {
        try {
          const session = await checkSession();
          if (getAuthGeneration() === generation) get().setSessionState(session);
        } catch {
          if (getAuthGeneration() === generation)
            get().setSessionState({ isAuthenticated: false, user_id: null, status: 'unavailable' });
        }
        const state = get();
        return {
          isAuthenticated: state.isAuthenticated,
          user_id: state.userSessionInfo?.user_id ?? null,
          expiresAt: state.expiresAt,
          status: state.status === 'unknown' ? 'unavailable' : state.status,
        };
      })().finally(() => {
        if (pending?.promise === promise) {
          pending = null;
          set({ isRefreshing: false });
        }
      });
      pending = { generation, promise };
      return promise;
    },
  }));
}

export const useAuthStore = createAuthStore();
export default useAuthStore;
