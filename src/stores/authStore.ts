// src/store/authStore.ts
import { create } from 'zustand';
import { AuthSessionState, getAuthSessionState } from '@/actions/login';

// Interfaces and types
interface AuthState {
  autoUpDateSession: () => Promise<AuthSessionState>;
  isAuthenticated: boolean;
  setIsAuthenticated: (bool: boolean) => void;
  setSessionState: (sessionState: AuthSessionState) => void;
  // setLoginState: (accessToken: string, refreshToken: string) => void;
  // setLogoutState: () => void;
  userSessionInfo: {
    user_id: string;
  } | null;
}

type UserSessionInfoType = AuthState['userSessionInfo'];

let authSessionSyncPromise: Promise<AuthSessionState> | null = null;

function getAuthStoreSessionState(sessionState: AuthSessionState) {
  const userSessionInfo = sessionState.user_id
    ? ({ user_id: sessionState.user_id } as UserSessionInfoType)
    : null;

  return {
    userSessionInfo,
    isAuthenticated: sessionState.isAuthenticated,
  };
}

// useAuthStore Hook
export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  setIsAuthenticated: (bool: boolean) => set({ isAuthenticated: bool }),
  setSessionState: (sessionState) => set(getAuthStoreSessionState(sessionState)),
  userSessionInfo: null,
  autoUpDateSession: async () => {
    if (!authSessionSyncPromise) {
      // Share one in-flight auth check across duplicate mounts and rerenders.
      authSessionSyncPromise = (async () => {
        const sessionState = await getAuthSessionState();

        set(getAuthStoreSessionState(sessionState));

        return sessionState;
      })();
    }

    try {
      return await authSessionSyncPromise;
    } finally {
      authSessionSyncPromise = null;
    }
  },
}));

export default useAuthStore;
