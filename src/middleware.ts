import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the incoming hostname

  // Check if the hostname is 'codexchristi.shop'
  if (hostname === 'codexchristi.shop') {
    // Logging to track the middleware activity
    logger.info(`Middleware triggered for ${url.pathname} on ${hostname}`);

    // Serve /shop and its child routes without rewriting the URL in the browser
    if (!url.pathname.startsWith('/shop')) {
      url.pathname = `/shop${url.pathname}`;
      logger.info(`Rewriting URL for ${url.pathname}`);
      return NextResponse.rewrite(url); // Rewrite to serve /shop content
    }
  }

  return NextResponse.next(); // Proceed with the default Next.js response
}

// Config for middleware matcher
export const config = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\.(jpg|jpeg|png|gif|webp|svg)).*)', // Exclude images and static files
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
