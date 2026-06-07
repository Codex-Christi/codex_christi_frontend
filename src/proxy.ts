import { createNEMO } from '@rescale/nemo';
import {
  redirectLoggedInUserToProfileMiddleware,
  redirectExpSessionToLoginPage,
} from './lib/middlewares/auth-middleware';
import { authVerifierAndRouteProtector } from './lib/middlewares/codexchristi.shop/authVerifierAndRouteProtector';

// Define a constant for the exclusion pattern (matches all paths under /_next including any sub-paths and query parameters, and /media with query parameters)
// const excludePattern =
//   /^\/(_next(?:\/[^ ]*)*(?:\?[^ ]*)?|media(?:\/[^ ]*)?(?:\?[^ ]*)?)/;

export const proxy = createNEMO({
  // Protected shop routes
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
    '/shop/account-overview/:path*',
    '/shop/auth/login',
    '/auth/sign-in',
    '/auth/signup',
    '/profile/:path*',
  ],
};
