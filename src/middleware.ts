import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the incoming hostname

  if (!hostname) {
    return NextResponse.next(); // Fallback if no host header exists
  }

  // Custom logic for codexchristi.shop (domain.shop)
  if (hostname === 'codexchristi.shop') {
    logger.info(
      `Middleware triggered for ${url.pathname} on codexchristi.shop`
    );

    // You can add more custom logic here, e.g., user authentication, logging, etc.
    // For now, we'll just pass all requests through as normal.
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
