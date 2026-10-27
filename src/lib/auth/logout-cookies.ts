import { NextResponse } from 'next/server';
import { buildExpiredAuthCookies, getExpiredAuthCookieOptions } from '../session/session-cookies';
import { ADMIN_SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_PATH } from '../admin/admin-config';

export function checkoutCookiesForLogout(cookieHeader: string | null) {
  return [
    ...new Set((cookieHeader ?? '').split(';').map((part) => part.split('=')[0].trim())),
  ].filter((name) => /^(?:checkout-browser|checkout-(?:access|proof)-[a-f0-9]{20})$/u.test(name));
}

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
    ...checkoutCookiesForLogout(requestHeaders.get('cookie')).map((name) => ({
      name,
      value: '',
      options: { ...options, domain: undefined, path: '/' },
    })),
  ];
  // Append serialized headers separately: a cookie map keyed by name loses one admin Path.
  for (const cookie of cookies) {
    const single = new NextResponse();
    single.cookies.set(cookie.name, cookie.value, cookie.options);
    response.headers.append('Set-Cookie', single.headers.get('Set-Cookie')!);
  }
  return response;
}
