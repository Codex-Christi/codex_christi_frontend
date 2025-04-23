import { verifySession } from './session-validate';
import { NextRequest, NextResponse } from 'next/server';

export const basicRedirect = (destination: string, req: NextRequest) => {
  return NextResponse.redirect(
    new URL(destination.startsWith('/') ? destination : '/', req.url)
  );
};

export const redirectLoggedInUserToProfile = async (req: NextRequest) => {
  // If user is logged in already, sedn them to profile page and show alert about logged in status
  if ((await verifySession()) === true) {
    return basicRedirect('/profile', req);
  }
};
