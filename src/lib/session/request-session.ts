import { NextRequest, NextResponse } from 'next/server';
import { deriveSessionState, SessionPayload } from './session-state';
import {
  buildExpiredAuthCookies,
  decryptSessionToken,
  getMainRefreshTokenFromCookieValue,
  REFRESH_TOKEN_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from './session-cookies';

type RequestSessionState = {
  isAuthenticated: boolean;
  userID: string | null;
  shouldClearCookies: boolean;
};

export async function getRequestSessionState(
  req: NextRequest,
): Promise<RequestSessionState> {
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return {
      isAuthenticated: false,
      userID: null,
      shouldClearCookies: false,
    };
  }

  try {
    const payload = await decryptSessionToken(sessionCookie);
    const sessionState = deriveSessionState(payload as SessionPayload, {
      hasSessionCookie: true,
    });

    return {
      isAuthenticated: sessionState.isAuthenticated,
      userID: sessionState.userID,
      shouldClearCookies: sessionState.shouldClearCookies,
    };
  } catch {
    return {
      isAuthenticated: false,
      userID: null,
      shouldClearCookies: true,
    };
  }
}

export async function getRequestRefreshToken(req: NextRequest) {
  return getMainRefreshTokenFromCookieValue(
    req.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value,
  );
}

export function clearAuthCookies(response: NextResponse, requestHeaders?: Headers) {
  for (const cookie of buildExpiredAuthCookies(requestHeaders)) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }

  return response;
}
