import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_LOGOUT_PATH,
  ADMIN_UNLOCK_PATH,
  buildAdminUnlockPath,
  sanitizeAdminReturnPath,
} from '@/lib/admin/admin-paths';
import {
  clearAdminSessionCookie,
  getRequestAdminSessionState,
} from '@/lib/admin/admin-session-request';
import { redirectLoggedInUserToProfile } from '../session/session-redirect';
import { clearAuthCookies, getRequestSessionState } from '../session/request-session';

export const redirectLoggedInUserToProfileMiddleware = async (request: NextRequest) => {
  return await redirectLoggedInUserToProfile(request);
};

export const redirectExpSessionToLoginPage = async (req: NextRequest) => {
  const hostname = req.headers.get('host');
  const sessionState = await getRequestSessionState(req);

  if (sessionState.isAuthenticated) {
    return NextResponse.next();
  }

  const response = NextResponse.redirect(
    new URL(
      `/auth/${hostname === 'codexchristi.shop' ? 'login' : 'sign-in'}?sessionExp=true`,
      req.url,
    ),
  );

  if (sessionState.shouldClearCookies) {
    return clearAuthCookies(response);
  }

  return response;
};

export const protectAdminRouteMiddleware = async (req: NextRequest) => {
  const pathWithSearch = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  const safeReturnPath = sanitizeAdminReturnPath(pathWithSearch, '/admin');
  const sessionState = await getRequestSessionState(req);

  if (!sessionState.isAuthenticated || !sessionState.userID) {
    const response = NextResponse.redirect(
      new URL(`/auth/sign-in?next=${encodeURIComponent(safeReturnPath)}`, req.url),
    );

    if (sessionState.shouldClearCookies) {
      return clearAuthCookies(response);
    }

    return response;
  }

  if (req.nextUrl.pathname === ADMIN_UNLOCK_PATH || req.nextUrl.pathname === ADMIN_LOGOUT_PATH) {
    return NextResponse.next();
  }

  const adminSession = await getRequestAdminSessionState(req);

  if (adminSession.isAuthenticated && adminSession.userID === sessionState.userID) {
    return NextResponse.next();
  }

  const response = NextResponse.redirect(new URL(buildAdminUnlockPath(safeReturnPath), req.url));

  if (adminSession.shouldClearCookie) {
    return clearAdminSessionCookie(response);
  }

  return response;
};
