import { NextResponse } from 'next/server';
import { buildExpiredAuthCookies, getExpiredAuthCookieOptions } from '../session/session-cookies';
import { buildExpiredAdminCookies } from '../admin/admin-session-cookies';
import { appendResponseCookies } from '../session/response-cookies';

export function checkoutCookiesForLogout(cookieHeader: string | null) {
  return [
    ...new Set((cookieHeader ?? '').split(';').map((part) => part.split('=')[0].trim())),
  ].filter((name) => /^(?:checkout-browser|checkout-(?:access|proof)-[a-f0-9]{20})$/u.test(name));
}

export function clearLogoutCookies(response: NextResponse, requestHeaders: Headers) {
  const options = getExpiredAuthCookieOptions(requestHeaders);
  const cookies = [
    ...buildExpiredAuthCookies(requestHeaders),
    ...buildExpiredAdminCookies(),
    ...checkoutCookiesForLogout(requestHeaders.get('cookie')).map((name) => ({
      name,
      value: '',
      options: { ...options, domain: undefined, path: '/' },
    })),
  ];
  return appendResponseCookies(response, cookies);
}
