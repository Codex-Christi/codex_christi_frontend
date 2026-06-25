import { NextRequest, NextResponse } from 'next/server';
import { getSafeAdminReturnPath } from '@/lib/admin/admin-paths';
import { getRequestSessionState } from './request-session';

export const basicRedirect = (destination: string, req: NextRequest) => {
  // If the destination is an absolute URL, redirect to that URL
  return NextResponse.redirect(new URL(destination.startsWith('/') ? destination : '/', req.url));
};

export const redirectLoggedInUserToProfile = async (req: NextRequest) => {
  if (req.method !== 'GET') {
    return NextResponse.next();
  }

  // If user is logged in already, send them to profile.
  const sessionState = await getRequestSessionState(req);

  if (sessionState.isAuthenticated) {
    return basicRedirect(
      getSafeAdminReturnPath(req.nextUrl.searchParams.get('next')) ??
        '/profile?from-login-page=true',
      req,
    );
  }

  return NextResponse.next();
};
