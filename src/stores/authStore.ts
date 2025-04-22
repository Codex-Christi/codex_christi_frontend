// src/store/authStore.ts
import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { useCallback, useRef } from 'react';
import { getCookie, decrypt } from '@/lib/session/main-session';
import { RequestCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { verifySession } from '@/lib/session/session-validate';

// Interfaces and types
interface AuthState {
  autoUpDateSession: () => Promise<void>;
  sessionCookie: RequestCookie | null;
  refreshToken: RequestCookie | null;
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
    const sessionCookie = await getCookie('session');
    const refreshToken = await getCookie('refreshToken');

    const decryptedSessionCookie = await decrypt(sessionCookie?.value);
    // console.log(jwtDecode(decryptedSessionCookie!.mainAccessToken as string));

    const userSessionInfo = {
      user_id: decryptedSessionCookie?.userID,
    } as UserSessionInfoType;
    const isAuthenticated = (await verifySession()) === true ? true : false;

    set((prevState) => {
      return {
        ...prevState,
        sessionCookie,
        refreshToken,
        userSessionInfo,
        isAuthenticated,
      };
    });
  },
}));

// useIsLoggedIn Hook
export const useIsLoggedIn = () => {
  const setLoggedIn = useAuthStore((s) => s.setIsAuthenticated);
  const lastValue = useRef<string | null>(null);

  const checkForCookie = useCallback(() => {
    getCookie('session').then((cookie) => {
      if (cookie && cookie.toString() !== lastValue.current) {
        lastValue.current = cookie ? cookie.toString() : null;
        setLoggedIn(!!cookie); // update Zustand
      }
    });
  }, [setLoggedIn]);

  alert(`Is logged in? ${useAuthStore((s) => s.isAuthenticated)}`);
};

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
