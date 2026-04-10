import { NextRequest, NextResponse } from 'next/server';
import { getRequestSessionState } from '@/lib/session/request-session';

export const authVerifierAndRouteProtector = async (req: NextRequest) => {
  // Auth verifier for shop login page on codexchristi.shop
  const hostname = req.headers.get('host'); // Get the incoming hostname

  if (hostname === 'localhost:3000' || hostname === 'codexchristi.shop') {
    const isLocalHost = hostname === 'localhost:3000';
    const isProdShopDomian = hostname === 'codexchristi.shop';

    const checkObj = { isLocalHost, isProdShopDomian, req };

    try {
      return checkAndRedirect(checkObj);
    } catch (error) {
      console.error('Error verifying session:', error);
      return NextResponse.next();
    }
  } else {
    return NextResponse.next();
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
  if (!obj) {
    return NextResponse.next();
  }

  const sessionState = await getRequestSessionState(req);

  if (sessionState.isAuthenticated) {
    return NextResponse.redirect(
      new URL(`${isLocalHost ? '/shop' : isProdShopDomian ? '' : ''}/account-overview`, req?.url),
    );
  }

  return NextResponse.next();
};
