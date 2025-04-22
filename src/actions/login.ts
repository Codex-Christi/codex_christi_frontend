'use server';

import { createSession, decrypt, getCookie } from '@/lib/session/main-session';

export async function createLoginSession(
  accessToken: string,
  refreshToken: string
) {
  try {
    await createSession(accessToken, refreshToken);

    return {
      success: true,
    };
  } catch (err: Error | unknown) {
    return {
      success: false,
      error: `${err}`,
    };
  }
}

export async function getUserID() {
  const sessionCookie = await getCookie('session');

  const decryptedSessionCookie = await decrypt(sessionCookie?.value);

  return decryptedSessionCookie?.userID as string;
}
