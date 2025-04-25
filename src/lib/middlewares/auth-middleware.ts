import { NextRequest } from 'next/server';
import { redirectLoggedInUserToProfile } from '../session/session-redirect';

export const defaultRedirectMiddleware = async (request: NextRequest) => {
  return await redirectLoggedInUserToProfile(request);
};
