import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const hostname = req.headers.get('host'); // Get the incoming hostname

  // Check if the hostname is 'codexchristi.shop'
  if (hostname === 'codexchristi.shop') {
    // Logging to track the middleware activity
    logger.info(`Middleware triggered for ${url.pathname} on ${hostname}`);

    // Checking if the request is for an image (jpg, jpeg, png, etc.)
    const isImageRequest = /\.(jpg|jpeg|png|gif|webp|svg)(\?|\b|$)/i.test(
      url.pathname
    );

    // If it's an image request, skip the middleware (pass through the request)
    if (isImageRequest) {
      return NextResponse.next(); // Allow image requests to bypass middleware
    }

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
    // Match all paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico, sitemap.xml, robots.txt (metadata files)
    // - Image extensions (.jpg, .jpeg, .png, .gif, .webp, .svg)
    {
      source:
        '/((?!api|_next/static|_next/image|wp-admin|favicon.ico|sitemap.xml|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' }, // Missing 'next-router-prefetch'
        { type: 'header', key: 'purpose', value: 'prefetch' }, // Missing 'purpose: prefetch'
      ],
    },
  ],
};
