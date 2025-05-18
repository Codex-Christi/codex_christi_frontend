import { verifySession } from './session-validate';
import { NextRequest, NextResponse } from 'next/server';

export const basicRedirect = (destination: string, req: NextRequest) => {
  // If the destination is an absolute URL, redirect to that URL
  return NextResponse.redirect(
    new URL(destination.startsWith('/') ? destination : '/', req.url)
  );
};

export const redirectLoggedInUserToProfile = async (req: NextRequest) => {
  // If user is logged in already, sedn them to profile page and show alert about logged in status
  try {
    if ((await verifySession()) === true) {
      return basicRedirect('/profile?from-login-page=true', req);
    }
  } catch (error) {
    console.error('Error verifying session:', error);
  }
};
