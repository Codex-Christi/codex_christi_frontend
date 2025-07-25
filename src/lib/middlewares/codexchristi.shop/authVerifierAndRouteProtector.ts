import { verifySession } from '@/lib/session/session-validate';
import { NextRequest, NextResponse } from 'next/server';

export const authVerifierAndRouteProtector = async (req: NextRequest) => {
  // Auth verifier for shop login page on codexchristi.shop
  const hostname = req.headers.get('host'); // Get the incoming hostname
  if (hostname === 'localhost:3000' || hostname === 'codexchristi.shop') {
    try {
      const referrer = req.headers.get('referer')?.split(hostname)[1];
      const url = req.nextUrl.clone().toString()?.split(hostname)[1];

      // Check if the referrer and URL are the same
      // and if the session is valid for GET requests
      if (url || referrer) {
        return checkAndRedirect(req);
      } else {
        return redirectToReferrer(req);
      }
    } catch (error) {
      console.error('Error verifying session:', error);
    }
  } else {
    // return redirectToReferrer(req);
    return checkAndRedirect(req);
  }
};

const redirectToReferrer = (req: NextRequest) => {
  const referrer = req.headers.get('referer');

  if (referrer) {
    // Redirect to the previous URL
    return NextResponse.redirect(new URL(referrer, req.url));
  }

  // Or redirect to a default URL if no referrer is found
  return NextResponse.redirect(new URL('/', req.url));
};

const checkAndRedirect = async (req: NextRequest) => {
  if ((await verifySession()) === true && req.method === 'GET') {
    return NextResponse.redirect(new URL('/shop/account-overview', req.url)); // Redirect to the referrer if session is valid
  } else {
    return NextResponse.next(); // Proceed with the request if session is valid
  }
};
