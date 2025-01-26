import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the incoming hostname

  if (!hostname) {
    return NextResponse.next(); // Fallback if no host header exists
  }

  if (hostname) {
    logger.info(`Middleware triggered for ${url.pathname}`);
    console.log(`Middleware triggered for ${url.pathname}`);
  }

  if (hostname === 'codexchristi.shop') {
    logger.info(`Middleware triggered for ${url.pathname}`);
    // Serve /shop and its child routes without rewriting the URL in the browser
    if (!url.pathname.startsWith('/shop')) {
      url.pathname = `/shop${url.pathname}`;
      return NextResponse.rewrite(url); // Rewrite to serve /shop content
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
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
