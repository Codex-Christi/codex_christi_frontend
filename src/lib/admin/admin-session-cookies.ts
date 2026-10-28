import type { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_PATH } from './admin-config';
import { getExpiredAuthCookieOptions } from '../session/session-cookies';
import { appendResponseCookies, type ResponseCookieDefinition } from '../session/response-cookies';

export function buildExpiredAdminCookies(): ResponseCookieDefinition[] {
  const options = getExpiredAuthCookieOptions();
  return [ADMIN_SESSION_COOKIE_PATH, '/'].map((path) => ({
    name: ADMIN_SESSION_COOKIE_NAME,
    value: '',
    options: { ...options, path },
  }));
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store');
  return appendResponseCookies(response, buildExpiredAdminCookies());
}
