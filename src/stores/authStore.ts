// src/store/authStore.ts
import { create } from 'zustand';
import { verifySession } from '@/lib/session/session-validate';
import { getUserID } from '@/actions/login';

// Interfaces and types
interface AuthState {
  autoUpDateSession: () => Promise<void>;
  isAuthenticated: boolean;
  setIsAuthenticated: (bool: boolean) => void;
  // setLoginState: (accessToken: string, refreshToken: string) => void;
  // setLogoutState: () => void;
  userSessionInfo: {
    user_id: string;
  } | null;
}

type UserSessionInfoType = AuthState['userSessionInfo'];

// useAuthStore Hook
export const useAuthStore = create<AuthState>((set) => ({
  sessionCookie: null,
  refreshToken: null,
  isAuthenticated: false,
  setIsAuthenticated: (bool: boolean) => set({ isAuthenticated: bool }),
  userSessionInfo: null,
  autoUpDateSession: async () => {
    // Check if session exists in localStorage
    // If not, do nothing
    if (!localStorage.getItem('session')) {
      return;
    }

    const userSessionInfo = {
      user_id: await getUserID(),
    } as UserSessionInfoType;
    const isAuthenticated = (await verifySession()) === true ? true : false;

    set((prevState) => {
      return {
        ...prevState,
        userSessionInfo,
        isAuthenticated,
      };
    });
  },
}));

export default useAuthStore;
