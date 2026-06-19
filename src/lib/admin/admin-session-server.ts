import 'server-only';

import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_PATH,
  ADMIN_SESSION_TTL_SECONDS,
  getDefaultAdminRole,
  getDefaultAdminScopes,
} from './admin-config';
import { signAdminSessionToken, verifyAdminSessionToken } from './admin-session-token';

export async function getServerAdminSessionState() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  return verifyAdminSessionToken(token);
}

export async function createAdminSession(userID: string) {
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000);
  const token = await signAdminSessionToken({
    userID,
    role: getDefaultAdminRole(),
    scopes: getDefaultAdminScopes(),
    expiresAt,
  });
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: ADMIN_SESSION_COOKIE_PATH,
    expires: expiresAt,
  });

  return { expiresAt };
}

export async function deleteAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: ADMIN_SESSION_COOKIE_PATH,
    expires: new Date(0),
  });
}

