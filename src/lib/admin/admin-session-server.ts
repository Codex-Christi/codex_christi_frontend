import 'server-only';

import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_PATH,
  ADMIN_SESSION_TTL_SECONDS,
  type AdminRole,
  type AdminScope,
} from './admin-config';
import { signAdminSessionToken, verifyAdminSessionToken } from './admin-session-token';
import type { ResponseCookieDefinition } from '../session/response-cookies';

export async function getServerAdminSessionState() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  return verifyAdminSessionToken(token);
}

export async function buildAdminSessionCookie({
  userID,
  role,
  scopes,
  sessionVersion,
}: {
  userID: string;
  role: AdminRole;
  scopes: AdminScope[];
  sessionVersion: number;
}): Promise<ResponseCookieDefinition> {
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000);
  const token = await signAdminSessionToken({
    userID,
    role,
    scopes,
    sessionVersion,
    expiresAt,
  });
  return {
    name: ADMIN_SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: ADMIN_SESSION_COOKIE_PATH,
      expires: expiresAt,
      maxAge: ADMIN_SESSION_TTL_SECONDS,
    },
  };
}
