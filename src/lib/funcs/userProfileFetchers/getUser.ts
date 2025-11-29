'use server';

import { decrypt } from '@/lib/session/main-session';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import { JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

export const getUser = cache(async (): Promise<UserProfileDataInterface | undefined> => {
  // Read session cookie once
  const cookieStore = cookies();
  const encryptedSession = (await cookieStore).get('session')?.value;

  if (!encryptedSession) {
    // No session at all – treat as unauthenticated
    return;
  }

  // Decrypt session and safely access access token
  let decryptedSession: JWTPayload | undefined;
  try {
    decryptedSession = await decrypt(encryptedSession);
  } catch (err) {
    console.error('Failed to decrypt session cookie:', err);
    return;
  }

  const mainAccessToken = decryptedSession?.mainAccessToken as string | undefined;

  if (!mainAccessToken) {
    // Missing access token – treat as unauthenticated
    return;
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/account/my-profile`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${mainAccessToken}`,
        'Content-Type': 'application/json',
      },
      // Always fetch fresh user data; React's `cache` will memoize per request
      cache: 'no-store',
    });

    // Handle unauthorized / not found in one place
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      console.log('User not found or unauthorized access');
      redirect('/next-api/logout');
    }

    if (!response.ok) {
      console.error('Failed to fetch user profile:', response.status, response.statusText);
      return;
    }

    const json = (await response.json()) as { data?: UserProfileDataInterface };

    return json.data;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return;
  }
});
