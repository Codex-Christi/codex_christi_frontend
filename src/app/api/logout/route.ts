import { NextResponse } from 'next/server';
import { getServerRefreshToken } from '@/lib/session/server-session';
import { cancelSessionRefresh } from '@/lib/session/session-refresh';
import { djangoRequest } from '@/lib/django/request';
import { isSameOriginMutation } from '@/lib/auth/request-origin';
import { clearLogoutCookies } from '@/lib/auth/logout-cookies';

const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ success: false }, { status: 403, headers });
  try {
    const refresh = await getServerRefreshToken();
    if (refresh) {
      cancelSessionRefresh(refresh);
      const response = await djangoRequest('/auth/user-logout', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refresh }),
      }, 3000);
      await response.body?.cancel();
    }
  } catch {
    // Django revocation is best effort. Local logout is unconditional.
  }
  return clearLogoutCookies(NextResponse.json({ success: true }, { headers }), request.headers);
}
export async function GET() {
  return NextResponse.json({ success: false, message: 'Use the Logout button to sign out.' }, { status: 405, headers: { ...headers, Allow: 'POST' } });
}
