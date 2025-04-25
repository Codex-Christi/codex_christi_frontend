// src/store/authStore.ts
import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
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
export const useAuthStore = create<AuthState>((set, get) => ({
  sessionCookie: null,
  refreshToken: null,
  isAuthenticated: false,
  setIsAuthenticated: (bool: boolean) => set({ isAuthenticated: bool }),
  userSessionInfo: null,
  autoUpDateSession: async () => {
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

function decodeJWT(token: string) {
  try {
    const decoded = jwtDecode(token);
    return decoded;
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

export default useAuthStore;
