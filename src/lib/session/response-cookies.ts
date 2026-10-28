import { NextResponse } from 'next/server';
import type { AuthCookieDefinition } from './session-cookies';

export type ResponseCookieDefinition = {
  name: string;
  value: string;
  options: Omit<AuthCookieDefinition['options'], 'path'> & { path: string; domain?: string };
};

// Append last: ResponseCookies.set() keys by name and loses same-name, different-Path cookies.
export function appendResponseCookies<T extends Response>(
  response: T,
  cookies: ResponseCookieDefinition[],
): T {
  for (const cookie of cookies) {
    const single = new NextResponse();
    single.cookies.set(cookie.name, cookie.value, cookie.options);
    response.headers.append('Set-Cookie', single.headers.get('Set-Cookie')!);
  }
  return response;
}
