import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  logger.info(`Middleware triggered for ${req.nextUrl.pathname}`);
  logger.info({ name: 'Saint', age: 21, boy: true });
  console.log('Hello');

  return NextResponse.next();
}

export const config = {
  matcher: '/:path*', // Apply middleware to all routes
};
