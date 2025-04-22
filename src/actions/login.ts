'use server';

import { createSession } from '@/lib/session/main-session';

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
