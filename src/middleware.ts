import { createNEMO } from '@rescale/nemo';
import {
  redirectLoggedInUserToProfileMiddleware,
  redirectExpSessionToLoginPage,
} from './lib/middlewares/auth-middleware';
import { authVerifierAndRouteProtector } from './lib/middlewares/codexchristi.shop/authVerifierAndRouteProtector';

// Define a constant for the exclusion pattern (matches all paths under /_next including any sub-paths and query parameters, and /media with query parameters)
// const excludePattern =
//   /^\/(_next(?:\/[^ ]*)*(?:\?[^ ]*)?|media(?:\/[^ ]*)?(?:\?[^ ]*)?)/;

export const middleware = createNEMO({
  // For shop
  '/shop': [],
  '/shop/account-overview': [redirectExpSessionToLoginPage],
  '/shop/account-overview/(.*)': [redirectExpSessionToLoginPage],
  '/shop/auth/login': [authVerifierAndRouteProtector],
  // For auth routes
  '/auth': {
    '/sign-in': [redirectLoggedInUserToProfileMiddleware],
    '/signup': [redirectLoggedInUserToProfileMiddleware],
  },
  '/profile': [redirectExpSessionToLoginPage],
});

// Config for middleware matcher
export const config = {
  matcher: [
    // Match all paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico, sitemap.xml, robots.txt (metadata files)
    {
      source: '/((?!api|_next|wp-admin|media|wordpress|favicon.ico|sitemap.xml|robots.txt).*)',
    },
  ],
};
