import { NextRequest, NextResponse } from 'next/server';
import { getRequestUrl } from '@/lib/siteBaseUrls';
import { getAuthRoutes, publicShopPath, safeAuthReturnPath } from '../auth/domain-routing';
import { getRequestSessionState } from './request-session';

export const basicRedirect = (destination: string, req: NextRequest) =>
  NextResponse.redirect(getRequestUrl(destination, req.headers, req.url));

export const redirectLoggedInUserToProfile = async (req: NextRequest, shop = false) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return NextResponse.next();
  const state = await getRequestSessionState(req);
  if (!state.isAuthenticated) return NextResponse.next();
  const host = req.headers.get('host') ?? '';
  const routes = getAuthRoutes(host, shop);
  const requested = req.nextUrl.searchParams.get('next');
  const path =
    safeAuthReturnPath(requested ? publicShopPath(requested, host) : null, routes) ??
    routes.account;
  const response = basicRedirect(path, req);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
};
