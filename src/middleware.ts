import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the incoming hostname

  logger.info(`for ${url.pathname}`);

  // Check if the hostname is 'codexchristi.shop'
  if (hostname === 'codexchristi.shop') {
    // Logging to track the middleware activity
    logger.info(`Middleware triggered for ${url.pathname} on ${hostname}`);
  }

  // **Handle 404 Cases**: If the route doesn't exist, redirect to `/shop/404`
  return NextResponse.rewrite(new URL('/shop/404', req.url));
}

// Config for middleware matcher
export const config = {
  matcher: [
    // Match all paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico, sitemap.xml, robots.txt (metadata files)
    {
      source:
        '/((?!api|_next/static|wp-admin|wordpress|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',

      // has: [{ type: 'header', key: 'x-present' }],
      // missing: [{ type: 'header', key: 'x-missing', value: 'prefetch' }],
    },
  ],
};
