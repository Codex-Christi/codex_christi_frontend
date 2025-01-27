import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the hostname of the incoming request

  if (hostname === 'codexchristi.shop') {
    // Do not rewrite requests for static OpenGraph images
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
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|wp-admin|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
