import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  logger.info(`Middleware triggered for ${req.nextUrl.pathname}`);
  logger.info({ name: 'Saint', age: 21, boy: true });
  console.log('Hello');

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
    // {
    //   source:
    //     '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
    //   has: [{ type: 'header', key: 'x-present' }],
    //   missing: [{ type: 'header', key: 'x-missing', value: 'prefetch' }],
    // },
  ],
};
