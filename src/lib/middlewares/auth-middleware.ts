import { NextRequest, NextResponse } from 'next/server';
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
