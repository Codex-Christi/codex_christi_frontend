'use server';

import { decrypt, getCookie } from './main-session';
import { deriveSessionState, SessionPayload, SessionState } from './session-state';

export async function getServerSessionState(): Promise<SessionState> {
  const sessionCookie = await getCookie('session');
  const sessionValue = sessionCookie?.value;
  const payload = sessionValue
    ? ((await decrypt(sessionValue)) as SessionPayload | undefined)
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
  const refreshTokenCookie = await getCookie('refreshToken');
  const refreshTokenValue = refreshTokenCookie?.value;

  if (!refreshTokenValue) {
    return null;
  }

  const payload = (await decrypt(refreshTokenValue)) as SessionPayload | undefined;

  return typeof payload?.mainRefreshToken === 'string' ? payload.mainRefreshToken : null;
}
