import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

// Define a constant for the exclusion pattern (matches /_next/image, /media, and OpenGraph/Twitter images with or without query parameters)
const excludePattern =
  /^\/(_next\/image(?:\?[^ ]*)?|media|opengraph-image|twitter-image)/;

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the incoming hostname

  // Only apply rewrite logic to non-root paths if the hostname matches 'codexchristi.shop'
  if (hostname === 'codexchristi.shop' && url.pathname !== '/') {
    // Apply rewrite only to paths that don't match the excludePattern
    if (!excludePattern.test(url.pathname)) {
      // Ensure the path starts with /shop if it doesn't already
      if (!url.pathname.startsWith('/shop')) {
        url.pathname = `/shop${url.pathname}`;
        return NextResponse.rewrite(url); // Rewrite the URL
      }
    }

    // Log for debugging (if necessary)
    logger.info(`${Date.now()} for ${hostname}/${url.pathname}`);
  }

  return NextResponse.next(); // Proceed with the default Next.js response
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
        '/((?!api|_next|wp-admin|wordpress|favicon.ico|sitemap.xml|robots.txt).*)',
    },
  ],
};
