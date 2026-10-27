import { NextResponse } from 'next/server';
import { buildExpiredAuthCookies, getExpiredAuthCookieOptions } from '../session/session-cookies';
import { ADMIN_SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_PATH } from '../admin/admin-config';

export function clearLogoutCookies(response: NextResponse, requestHeaders: Headers) {
  const options = getExpiredAuthCookieOptions(requestHeaders);
  const cookies = [
    ...buildExpiredAuthCookies(requestHeaders),
    {
      name: ADMIN_SESSION_COOKIE_NAME,
      value: '',
      options: { ...options, path: ADMIN_SESSION_COOKIE_PATH },
    },
    { name: ADMIN_SESSION_COOKIE_NAME, value: '', options },
  ];
  // Append serialized headers separately: a cookie map keyed by name loses one admin Path.
  for (const cookie of cookies) {
    const single = new NextResponse();
    single.cookies.set(cookie.name, cookie.value, cookie.options);
    response.headers.append('Set-Cookie', single.headers.get('Set-Cookie')!);
  }
  return response;
}
