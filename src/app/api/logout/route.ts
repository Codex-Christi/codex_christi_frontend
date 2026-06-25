// app/api/logout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerDjangoApiBaseUrl } from '@/lib/django/getServerDjangoApiBaseUrl';
import { deleteSession } from '@/lib/session/main-session';
import { getServerRefreshToken } from '@/lib/session/server-session';
import { getHostnameFromHostHeader, isShopSiteHostname } from '@/lib/siteBaseUrls';

export async function GET(req: NextRequest) {
  const hostname = getHostnameFromHostHeader(req.headers.get('host'));
  const loginPath = isShopSiteHostname(hostname) ? '/auth/login' : '/auth/sign-in';
  const redirectUrl = new URL(`${loginPath}?from-logout=true`, req.url);

  try {
    const mainRefreshToken = await getServerRefreshToken();

    if (mainRefreshToken) {
      const response = await fetch(`${getServerDjangoApiBaseUrl()}/auth/user-logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh: mainRefreshToken }),
        cache: 'no-store',
      });

      if (!response.ok) {
        console.warn('[auth.logout.django_failed]', {
          status: response.status,
          statusText: response.statusText,
        });
      }
    }
  } catch (err) {
    console.warn('[auth.logout.failed]', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await deleteSession();
  }

  const response = NextResponse.redirect(redirectUrl);
  response.headers.set('Cache-Control', 'no-store');

  return response;
}
