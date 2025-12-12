import { verifySession } from '@/lib/session/session-validate';
import { NextRequest, NextResponse } from 'next/server';

export const authVerifierAndRouteProtector = async (req: NextRequest) => {
  // Auth verifier for shop login page on codexchristi.shop
  const hostname = req.headers.get('host'); // Get the incoming hostname

  if (hostname === 'localhost:3000' || hostname === 'codexchristi.shop') {
    const isLocalHost = hostname === 'localhost:3000';
    const isProdShopDomian = hostname === 'codexchristi.shop';

    const checkObj = { isLocalHost, isProdShopDomian, req };

    try {
      // const referrer = req.headers.get('referer')?.split(hostname)[1];
      // const url = req.nextUrl.clone().toString()?.split(hostname)[1];

      // Check if the referrer and URL are the same
      // and if the session is valid for GET requests

      return checkAndRedirect(checkObj);
    } catch (error) {
      console.error('Error verifying session:', error);
    }
  } else {
    // return redirectToReferrer(req);
    return checkAndRedirect();
  }
};

// const redirectToReferrer = (req: NextRequest) => {
//   const referrer = req.headers.get('referer');

//   if (referrer) {
//     // Redirect to the previous URL
//     return NextResponse.redirect(new URL(referrer, req.url));
//   }

//   // Or redirect to a default URL if no referrer is found
//   return NextResponse.redirect(new URL('/', req.url));
// };

type CheckAndRedirectType = {
  isLocalHost?: boolean;
  req: NextRequest;
  isProdShopDomian?: boolean;
};

const checkAndRedirect = async (obj?: CheckAndRedirectType) => {
  const { req, isLocalHost, isProdShopDomian } = obj || {};
  if ((await verifySession()) === true && obj) {
    return NextResponse.redirect(
      new URL(`${isLocalHost ? '/shop' : isProdShopDomian ? '' : ''}/account-overview`, req?.url),
    ); // Redirect to the referrer if session is valid
  } else {
    return NextResponse.next(); // Proceed with the request if session is valid
  }
};
