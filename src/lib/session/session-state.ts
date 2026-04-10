import { JWTPayload } from 'jose';

export interface SessionPayload extends JWTPayload {
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
}

export function deriveSessionState(
  payload?: SessionPayload | null,
  options?: { hasSessionCookie?: boolean },
): SessionState {
  const hasSessionCookie = options?.hasSessionCookie ?? false;

  if (!payload?.exp) {
    return {
      isAuthenticated: false,
      userID: null,
      mainAccessToken: null,
      mainRefreshToken: null,
      expiresSoon: false,
      shouldClearCookies: hasSessionCookie,
    };
  }

  const hoursToSessionExpiry = compareDatesInHours(new Date(payload.exp * 1000));

  if (hoursToSessionExpiry <= 0) {
    return {
      isAuthenticated: false,
      userID: null,
      mainAccessToken: null,
      mainRefreshToken: null,
      expiresSoon: false,
      shouldClearCookies: hasSessionCookie,
    };
  }

  return {
    isAuthenticated: true,
    userID: getStringValue(payload.userID),
    mainAccessToken: getStringValue(payload.mainAccessToken),
    mainRefreshToken: getStringValue(payload.mainRefreshToken),
    expiresSoon: hoursToSessionExpiry <= 24,
    shouldClearCookies: false,
  };
}

function compareDatesInHours(targetDate: Date | string | number) {
  const date = new Date(targetDate);
  const now = new Date();

  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  return Math.ceil(diffHours);
}

function getStringValue(value: unknown) {
  return typeof value === 'string' ? value : null;
}
