import { NextRequest, NextResponse } from 'next/server';
import logger from './logger';

export function middleware(req: NextRequest) {
  logger.info(`Middleware triggered for ${req.nextUrl.pathname}`);
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*', // Apply middleware to all routes
};
