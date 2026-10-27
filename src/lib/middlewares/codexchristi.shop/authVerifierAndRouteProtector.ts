import { NextRequest } from 'next/server';
import { redirectLoggedInUserToProfile } from '@/lib/session/session-redirect';

export const authVerifierAndRouteProtector = (req: NextRequest) =>
  redirectLoggedInUserToProfile(req, true);
