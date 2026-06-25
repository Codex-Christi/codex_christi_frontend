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
import {
  clearAuthCookies,
  getRequestRefreshToken,
  getRequestSessionState,
} from '../session/request-session';
import {
  buildAuthSessionCookies,
  SESSION_REFRESH_GUARD_PARAM,
} from '../session/session-cookies';
import { refreshDjangoSessionTokens } from '../session/session-refresh';
import {
  getHostnameFromHostHeader,
  getRequestUrl,
  isShopSiteHostname,
} from '../siteBaseUrls';

export const redirectLoggedInUserToProfileMiddleware = async (request: NextRequest) => {
  return await redirectLoggedInUserToProfile(request);
};

function hasRefreshGuard(req: NextRequest) {
  return req.nextUrl.searchParams.has(SESSION_REFRESH_GUARD_PARAM);
}

function getPathWithSearchWithoutSessionRefreshGuard(req: NextRequest) {
  const cleanUrl = req.nextUrl.clone();
  cleanUrl.searchParams.delete(SESSION_REFRESH_GUARD_PARAM);

  return `${cleanUrl.pathname}${cleanUrl.search}`;
}

function getRequestPathUrl(req: NextRequest, pathWithSearch: string) {
  return getRequestUrl(pathWithSearch, req.headers, req.url);
}

function redirectWithoutSessionRefreshGuard(req: NextRequest) {
  if (!hasRefreshGuard(req)) return null;

  return NextResponse.redirect(
    getRequestPathUrl(req, getPathWithSearchWithoutSessionRefreshGuard(req)),
  );
}

async function refreshRequestSession(req: NextRequest) {
  if (hasRefreshGuard(req)) return null;

  const currentRefreshToken = await getRequestRefreshToken(req);

  if (!currentRefreshToken) {
    return null;
  }

  try {
    const refreshedTokens = await refreshDjangoSessionTokens(currentRefreshToken);
    const builtCookies = await buildAuthSessionCookies({
      accessToken: refreshedTokens.accessToken,
      refreshToken: refreshedTokens.refreshToken,
      requestHeaders: req.headers,
    });
    const refreshUrl = getRequestPathUrl(
      req,
      `${req.nextUrl.pathname}${req.nextUrl.search}`,
    );
    refreshUrl.searchParams.set(SESSION_REFRESH_GUARD_PARAM, '1');

    const response = NextResponse.redirect(refreshUrl);
    response.headers.set('Cache-Control', 'no-store');

    for (const cookie of builtCookies.cookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }

    return response;
  } catch (error) {
    console.warn('[auth.session_refresh_failed]', {
      path: req.nextUrl.pathname,
      error: error instanceof Error ? error.message : String(error),
    });

    return null;
  }
}

function clearFailedSessionCookiesIfNeeded({
  req,
  response,
  shouldClearCookies,
}: {
  req: NextRequest;
  response: NextResponse;
  shouldClearCookies: boolean;
}) {
  return shouldClearCookies || hasRefreshGuard(req)
    ? clearAuthCookies(response, req.headers)
    : response;
}

export const redirectExpSessionToLoginPage = async (req: NextRequest) => {
  const hostname = getHostnameFromHostHeader(req.headers.get('host'));
  const sessionState = await getRequestSessionState(req);

  if (sessionState.isAuthenticated) {
    const cleanRefreshGuardResponse = redirectWithoutSessionRefreshGuard(req);
    if (cleanRefreshGuardResponse) return cleanRefreshGuardResponse;

    return NextResponse.next();
  }

  const refreshResponse = await refreshRequestSession(req);
  if (refreshResponse) return refreshResponse;

  const response = NextResponse.redirect(
    getRequestPathUrl(
      req,
      `/auth/${isShopSiteHostname(hostname) ? 'login' : 'sign-in'}?sessionExp=true`,
    ),
  );

  return clearFailedSessionCookiesIfNeeded({
    req,
    response,
    shouldClearCookies: sessionState.shouldClearCookies,
  });
};

export const protectAdminRouteMiddleware = async (req: NextRequest) => {
  const pathWithSearch = getPathWithSearchWithoutSessionRefreshGuard(req);
  const safeReturnPath = sanitizeAdminReturnPath(pathWithSearch, '/admin');
  const sessionState = await getRequestSessionState(req);

  if (!sessionState.isAuthenticated || !sessionState.userID) {
    const refreshResponse = await refreshRequestSession(req);
    if (refreshResponse) return refreshResponse;

    const response = NextResponse.redirect(
      getRequestPathUrl(req, `/auth/sign-in?next=${encodeURIComponent(safeReturnPath)}`),
    );

    return clearFailedSessionCookiesIfNeeded({
      req,
      response,
      shouldClearCookies: sessionState.shouldClearCookies,
    });
  }

  const cleanRefreshGuardResponse = redirectWithoutSessionRefreshGuard(req);
  if (cleanRefreshGuardResponse) return cleanRefreshGuardResponse;

  if (req.nextUrl.pathname === ADMIN_UNLOCK_PATH || req.nextUrl.pathname === ADMIN_LOGOUT_PATH) {
    return NextResponse.next();
  }

  const adminSession = await getRequestAdminSessionState(req);

  if (adminSession.isAuthenticated && adminSession.userID === sessionState.userID) {
    return NextResponse.next();
  }

  const response = NextResponse.redirect(
    getRequestPathUrl(req, buildAdminUnlockPath(safeReturnPath)),
  );

  if (adminSession.shouldClearCookie) {
    return clearAdminSessionCookie(response);
  }

  return response;
};
