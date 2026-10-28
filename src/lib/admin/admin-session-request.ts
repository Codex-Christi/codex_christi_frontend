import { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE_NAME } from './admin-config';
import { verifyAdminSessionToken } from './admin-session-token';

export { clearAdminSessionCookie } from './admin-session-cookies';

export async function getRequestAdminSessionState(req: NextRequest) {
  return verifyAdminSessionToken(req.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value);
}
