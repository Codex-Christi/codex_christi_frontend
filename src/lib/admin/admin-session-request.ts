import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_PATH } from './admin-config';
import { verifyAdminSessionToken } from './admin-session-token';

const LEGACY_ADMIN_SESSION_COOKIE_PATHS = ['/'];

export async function getRequestAdminSessionState(req: NextRequest) {
  return verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value);
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
    expires: new Date(0),
    httpOnly: true,
    path: ADMIN_SESSION_COOKIE_PATH,
    sameSite: 'lax',
  });

  for (const path of LEGACY_ADMIN_SESSION_COOKIE_PATHS) {
    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', {
      expires: new Date(0),
      httpOnly: true,
      path,
      sameSite: 'lax',
    });
  }

  return response;
}
