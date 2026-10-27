import { JWTPayload } from 'jose';
import { AUTH_SESSION_VERSION } from './session-cookies';

export interface SessionPayload extends JWTPayload {
  version?: number;
  kind?: string;
  userID?: string;
  mainAccessToken?: string | null;
  mainRefreshToken?: string | null;
}

export interface SessionState {
  isAuthenticated: boolean;
  userID: string | null;
  mainAccessToken: string | null;
  mainRefreshToken: string | null;
  expiresSoon: boolean;
  shouldClearCookies: boolean;
  expiresAt: number | null;
}

export function deriveSessionState(
  payload?: SessionPayload | null,
  options?: { hasSessionCookie?: boolean },
): SessionState {
  const hasSessionCookie = options?.hasSessionCookie ?? false;

  if (
    payload?.version !== AUTH_SESSION_VERSION ||
    payload.kind !== 'access' ||
    typeof payload.exp !== 'number' ||
    !Number.isFinite(payload.exp) ||
    typeof payload.userID !== 'string' ||
    !payload.userID ||
    typeof payload.mainAccessToken !== 'string' ||
    !payload.mainAccessToken
  ) {
    return {
      isAuthenticated: false,
      userID: null,
      mainAccessToken: null,
      mainRefreshToken: null,
      expiresSoon: false,
      shouldClearCookies: hasSessionCookie,
      expiresAt: null,
    };
  }

  const secondsToExpiry = payload.exp - Date.now() / 1000;

  if (secondsToExpiry <= 0) {
    return {
      isAuthenticated: false,
      userID: null,
      mainAccessToken: null,
      mainRefreshToken: null,
      expiresSoon: false,
      shouldClearCookies: hasSessionCookie,
      expiresAt: null,
    };
  }

  return {
    isAuthenticated: true,
    userID: getStringValue(payload.userID),
    mainAccessToken: getStringValue(payload.mainAccessToken),
    mainRefreshToken: getStringValue(payload.mainRefreshToken),
    expiresSoon: secondsToExpiry <= 30,
    shouldClearCookies: false,
    expiresAt: payload.exp * 1000,
  };
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : null;
}
