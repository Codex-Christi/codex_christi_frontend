'use server';

import { cookies, headers } from 'next/headers';
import {
  buildAuthSessionCookies,
  buildExpiredAuthCookies,
  getMainRefreshTokenFromCookieValue,
  REFRESH_TOKEN_COOKIE_NAME,
  type AuthCookieDefinition,
} from './session-cookies';
import { refreshDjangoSessionTokens } from './session-refresh';

export interface CreatedSession {
  userID: string;
}

export type RefreshSessionResult =
  | {
      success: true;
      session: CreatedSession;
    }
  | {
      success: false;
      error: string;
    };

async function writeAuthCookies(authCookies: AuthCookieDefinition[]) {
  const cookieStore = await cookies();

  for (const cookie of authCookies) {
    cookieStore.set(cookie.name, cookie.value, cookie.options);
  }
}

export async function createSession(
  accessToken: string,
  refreshToken: string,
): Promise<CreatedSession> {
  const requestHeaders = await headers();
  const builtCookies = await buildAuthSessionCookies({
    accessToken,
    refreshToken,
    requestHeaders,
  });

  await writeAuthCookies(builtCookies.cookies);

  return {
    userID: builtCookies.userID,
  };
}

export async function refreshSession(): Promise<RefreshSessionResult> {
  const refreshTokenCookie = await getCookie(REFRESH_TOKEN_COOKIE_NAME);
  const currentRefreshToken = await getMainRefreshTokenFromCookieValue(refreshTokenCookie?.value);

  if (!currentRefreshToken) {
    return clearSessionAfterRefreshFailure('No refresh token found.');
  }

  try {
    const refreshedTokens = await refreshDjangoSessionTokens(currentRefreshToken);
    const session = await createSession(
      refreshedTokens.accessToken,
      refreshedTokens.refreshToken,
    );

    return {
      success: true,
      session,
    };
  } catch (error) {
    return clearSessionAfterRefreshFailure(
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function clearSessionAfterRefreshFailure(error: string): Promise<RefreshSessionResult> {
  await deleteSession();

  return {
    success: false,
    error,
  };
}

export async function deleteSession() {
  const requestHeaders = await headers();

  await writeAuthCookies(buildExpiredAuthCookies(requestHeaders));
}

export const getCookie = async (name: string) => {
  const cookieStore = await cookies();

  return cookieStore.get(name);
};
