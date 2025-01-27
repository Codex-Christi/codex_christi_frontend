import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the hostname of the incoming request

  if (hostname === 'codexchristi.shop') {
    // Do not rewrite requests for static OpenGraph images
    logger.info(
      `Middleware triggered for ${url.pathname} on codexchristi.shop`
    );

    if (url.pathname.endsWith('.jpg')) {
      return NextResponse.next();
    }
    // Rewrite all requests from codexchristi.shop to serve /shop but keep the domain.shop structure
    if (!url.pathname.startsWith('/shop')) {
      url.pathname = `/shop${url.pathname}`;
      logger.info(
        `Middleware triggered for ${url.pathname} on codexchristi.shop`
      );
      return NextResponse.rewrite(url); // Rewrite without redirecting
    }
  }

  return NextResponse.next();
}

// Matcher for filtering middleware
/*
 * Match all request paths except for the ones starting with:
 * - api (API routes)
 * - _next/static (static files)
 * - _next/image (image optimization files)
 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
 */
export const config = {
  matcher: [
    // Match all paths except for specific static paths and image requests (like .jpg, .jpeg, .png)
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\.(jpg|jpeg|png|gif|webp|svg)).*)',

    {
      // Match requests that are missing specific headers (e.g., prefetch headers)
      missing: [
        { type: 'header', key: 'next-router-prefetch' }, // Missing 'next-router-prefetch'
        { type: 'header', key: 'purpose', value: 'prefetch' }, // Missing 'purpose: prefetch'
      ],
    },
  ],
};
