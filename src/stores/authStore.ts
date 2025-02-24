// src/store/authStore.ts
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';

// Interfaces and types
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setLoginState: (accessToken: string, refreshToken: string) => void;
  setLogoutState: () => void;
  userLoginInfo: {
    user_id: string;
    name: string;
    email: string;
    username: string;
  } | null;
}

type UserLoginInfoType = AuthState['userLoginInfo'];

const setCookie = Cookies.set;
const localAccessToken = Cookies.get('accessToken');
const localRefreshToken = Cookies.get('refreshToken');
const decodedAccessToken = !!localAccessToken
  ? (decodeJWT(localAccessToken) as UserLoginInfoType)
  : null;

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: !!localAccessToken ? localAccessToken : null,
  refreshToken: !!localRefreshToken ? localRefreshToken : null,
  isAuthenticated: !!decodedAccessToken ? true : false,
  setLoginState: (accessToken: string, refreshToken: string) => {
    setCookie('accessToken', accessToken);
    setCookie('refreshToken', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
    const decodedResp = decodeJWT(accessToken) as UserLoginInfoType;

    set((prevState) => {
      return { ...prevState, userLoginInfo: decodedResp };
    });
  },
  setLogoutState: () => {
    Cookies.remove('accessToken');
    Cookies.remove('refreshToken');
    set({ accessToken: null, refreshToken: null, isAuthenticated: false });
  },
  userLoginInfo: !!decodedAccessToken ? decodedAccessToken : null,
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
