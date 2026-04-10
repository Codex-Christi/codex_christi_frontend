import { getServerSessionState } from './server-session';

export async function verifySession() {
  return (await getServerSessionState()).isAuthenticated;
}
