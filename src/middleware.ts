import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the incoming hostname

  // Only apply rewrite logic to non-root paths
  if (hostname === 'codexchristi.shop' && url.pathname !== '/') {
    if (!url.pathname.startsWith('/shop')) {
      url.pathname = `/shop${url.pathname}`;
      return NextResponse.rewrite(url);
    }

    logger.info(
      `${Date.now().toLocaleString()} for ${hostname}/${url.pathname}`
    );
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
