import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_LOGOUT_PATH,
  ADMIN_UNLOCK_PATH,
  ADMIN_TRANSFER_ACCEPT_PATH,
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
  assertSessionRefreshActive,
  refreshDjangoSessionTokens,
  SessionRefreshError,
} from '../session/session-refresh';
import {
  buildAuthSessionCookies,
  type AuthCookieDefinition,
  SESSION_REFRESH_GUARD_PARAM,
} from '../session/session-cookies';
import { getRequestUrl } from '../siteBaseUrls';
import {
  authFlowUrl,
  getAuthRoutes,
  publicShopPath,
  safeAuthReturnPath,
} from '../auth/domain-routing';

export const redirectLoggedInUserToProfileMiddleware = (req: NextRequest) =>
  redirectLoggedInUserToProfile(req);

async function protect(req: NextRequest, admin: boolean) {
  // The legacy lock alias handles its own method/origin checks, without refreshing login.
  if (admin && req.nextUrl.pathname === ADMIN_LOGOUT_PATH) return NextResponse.next();
  // Unsafe methods are checked by their own actions/handlers; never replay a POST via redirects.
  if (req.method !== 'GET' && req.method !== 'HEAD') return NextResponse.next();
  const host = req.headers.get('host') ?? '';
  const routes = getAuthRoutes(host, req.nextUrl.pathname.startsWith('/shop/'));
  const cleanUrl = req.nextUrl.clone();
  cleanUrl.searchParams.delete(SESSION_REFRESH_GUARD_PARAM);
  const path = publicShopPath(`${cleanUrl.pathname}${cleanUrl.search}`, host);
  const returnPath = admin
    ? sanitizeAdminReturnPath(path)
    : (safeAuthReturnPath(path, routes) ?? routes.account);
  const unavailable = () => {
    const destination = getRequestUrl(
      `${routes.prefix}/auth/session-unavailable`,
      req.headers,
      req.url,
    );
    destination.searchParams.set('next', returnPath);
    return NextResponse.redirect(destination, {
      status: 307,
      headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '5' },
    });
  };
  let state = await getRequestSessionState(req);
  let freshCookies: AuthCookieDefinition[] = [];
  let assertRefreshActive: (() => void) | undefined;
  let clearCookies = state.shouldClearCookies;
  if (!state.isAuthenticated) {
    const token = await getRequestRefreshToken(req);
    if (token) {
      try {
        const tokens = await refreshDjangoSessionTokens(token);
        const built = await buildAuthSessionCookies({ ...tokens, requestHeaders: req.headers });
        assertRefreshActive = () => assertSessionRefreshActive(token, tokens);
        assertRefreshActive();
        freshCookies = built.cookies;
        for (const cookie of freshCookies) req.cookies.set(cookie.name, cookie.value);
        state = await getRequestSessionState(req);
      } catch (error) {
        if (!(error instanceof SessionRefreshError && error.invalid)) {
          return unavailable();
        }
        freshCookies = [];
        assertRefreshActive = undefined;
        clearCookies = true;
      }
    } else {
      clearCookies = true;
    }
  }
  const finish = (response: NextResponse) => {
    // Recheck after session/admin awaits, immediately before writing response cookies.
    if (freshCookies.length) {
      try {
        assertRefreshActive?.();
      } catch (error) {
        if (!(error instanceof SessionRefreshError && error.invalid)) {
          return unavailable();
        }
        const destination = getRequestUrl(
          authFlowUrl(admin ? '/auth/sign-in' : routes.login, { next: returnPath }),
          req.headers,
          req.url,
        );
        return clearAuthCookies(
          NextResponse.redirect(destination, { headers: { 'Cache-Control': 'private, no-store' } }),
          req.headers,
        );
      }
    }
    for (const cookie of freshCookies)
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    response.headers.set('Cache-Control', 'private, no-store');
    return clearCookies && freshCookies.length === 0
      ? clearAuthCookies(response, req.headers)
      : response;
  };
  const redirect = (destination: string) =>
    finish(NextResponse.redirect(getRequestUrl(destination, req.headers, req.url)));
  if (!state.isAuthenticated || !state.userID) {
    const login = admin ? '/auth/sign-in' : routes.login;
    return redirect(`${authFlowUrl(login, { next: returnPath })}&sessionExp=true`);
  }
  if (req.nextUrl.searchParams.has(SESSION_REFRESH_GUARD_PARAM)) return redirect(path);
  if (
    admin &&
    req.nextUrl.pathname !== ADMIN_UNLOCK_PATH &&
    req.nextUrl.pathname !== ADMIN_TRANSFER_ACCEPT_PATH
  ) {
    const unlocked = await getRequestAdminSessionState(req);
    if (!unlocked.isAuthenticated || unlocked.userID !== state.userID) {
      const response = redirect(buildAdminUnlockPath(returnPath));
      return unlocked.shouldClearCookie ? clearAdminSessionCookie(response) : response;
    }
  }
  const forwarded = new Headers(req.headers);
  if (freshCookies.length) forwarded.set('cookie', req.cookies.toString());
  return finish(NextResponse.next({ request: { headers: forwarded } }));
}

export const redirectExpSessionToLoginPage = (req: NextRequest) => protect(req, false);
export const protectAdminRouteMiddleware = (req: NextRequest) => protect(req, true);
