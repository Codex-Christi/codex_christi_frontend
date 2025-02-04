import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the incoming hostname

  // Check if the hostname is 'codexchristi.shop'
  if (hostname === 'codexchristi.shop') {
    // Force Next.js to treat requests as being inside `/shop/`
    if (!url.pathname.startsWith('/shop') && url.pathname !== '/') {
      url.pathname = `/shop${url.pathname}`;
      return NextResponse.rewrite(url);
    }
    logger.info(`${url.pathname}`);
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
        '/((?!api|_next/static|wp-admin|wordpress|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',

      // has: [{ type: 'header', key: 'x-present' }],
      // missing: [{ type: 'header', key: 'x-missing', value: 'prefetch' }],
    },
  ],
};
