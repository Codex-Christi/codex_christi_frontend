import { create } from 'zustand';
import { type AuthSessionState, getAuthSessionState } from '@/actions/login';
import { advanceAuthGeneration, getAuthGeneration } from '@/lib/auth/session-generation';

interface AuthState {
  refreshAuthState: () => Promise<AuthSessionState>;
  isAuthenticated: boolean;
  status: 'unknown' | 'authenticated' | 'anonymous' | 'unavailable';
  expiresAt: number | null;
  setSessionState: (session: AuthSessionState) => void;
  userSessionInfo: { user_id: string } | null;
}
let pending: { generation: number; promise: Promise<AuthSessionState> } | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  userSessionInfo: null,
  status: 'unknown',
  expiresAt: null,
  setSessionState: (session) => {
    const authenticated = session.isAuthenticated && Boolean(session.user_id);
    const id = authenticated ? session.user_id : null;
    if (id !== (get().userSessionInfo?.user_id ?? null) || authenticated !== get().isAuthenticated)
      advanceAuthGeneration();
    set({
      isAuthenticated: authenticated,
      userSessionInfo: id ? { user_id: id } : null,
      expiresAt: session.expiresAt ?? null,
      status: session.status ?? (authenticated ? 'authenticated' : 'anonymous'),
    });
  },
  refreshAuthState: () => {
    const generation = getAuthGeneration();
    if (pending?.generation === generation) return pending.promise;
    const promise = (async () => {
      try {
        const session = await getAuthSessionState();
        if (getAuthGeneration() === generation) get().setSessionState(session);
      } catch {
        if (getAuthGeneration() === generation)
          get().setSessionState({ isAuthenticated: false, user_id: null, status: 'unavailable' });
      }
      return {
        isAuthenticated: get().isAuthenticated,
        user_id: get().userSessionInfo?.user_id ?? null,
        expiresAt: get().expiresAt,
      };
    })().finally(() => {
      if (pending?.generation === generation) pending = null;
    });
    pending = { generation, promise };
    return promise;
  },
}));
export default useAuthStore;
