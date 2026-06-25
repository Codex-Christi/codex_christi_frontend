'use server';

import { getCookie } from './main-session';
import {
  decryptSessionToken,
  getMainRefreshTokenFromCookieValue,
  REFRESH_TOKEN_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from './session-cookies';
import { deriveSessionState, SessionPayload, SessionState } from './session-state';

export async function getServerSessionState(): Promise<SessionState> {
  const sessionCookie = await getCookie(SESSION_COOKIE_NAME);
  const sessionValue = sessionCookie?.value;
  const payload = sessionValue
    ? ((await decryptSessionToken(sessionValue)) as SessionPayload | undefined)
    : undefined;

  return deriveSessionState(payload, {
    hasSessionCookie: Boolean(sessionValue),
  });
}

export async function getServerUserID() {
  return (await getServerSessionState()).userID;
}

export async function getServerAccessToken() {
  return (await getServerSessionState()).mainAccessToken;
}

export async function getServerRefreshToken() {
  const refreshTokenCookie = await getCookie(REFRESH_TOKEN_COOKIE_NAME);

  return getMainRefreshTokenFromCookieValue(refreshTokenCookie?.value);
}
