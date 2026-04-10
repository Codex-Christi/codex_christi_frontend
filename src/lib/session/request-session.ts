import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { deriveSessionState, SessionPayload } from './session-state';

type RequestSessionState = {
  isAuthenticated: boolean;
  userID: string | null;
  shouldClearCookies: boolean;
};

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

export async function getRequestSessionState(
  req: NextRequest,
): Promise<RequestSessionState> {
  const sessionCookie = req.cookies.get('session')?.value;

  if (!sessionCookie) {
    return {
      isAuthenticated: false,
      userID: null,
      shouldClearCookies: false,
    };
  }

  try {
    const { payload } = await jwtVerify(sessionCookie, encodedKey, {
      algorithms: ['HS256'],
    });
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

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set('session', '', {
    expires: new Date(0),
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });
  response.cookies.set('refreshToken', '', {
    expires: new Date(0),
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
  });

  return response;
}
