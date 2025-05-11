'use client';

import { decrypt, deleteSession } from '@/lib/session/main-session';
import axios from 'axios';
import { getCookie } from '@/lib/session/main-session';
import { clearUserMainProfileStore } from '@/stores/userMainProfileStore';

const axiosClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export const logoutUser = async () => {
  try {
    const sessionCookie = await getCookie('session');

    const decryptedSessionCookie = await decrypt(sessionCookie?.value);
    const mainAccessToken = decryptedSessionCookie
      ? (decryptedSessionCookie.mainAccessToken as string)
      : ('' as string);
    await axiosClient.post('/auth/user-logout', {
      headers: {
        Authorization: `Bearer ${mainAccessToken}`,
      },
    });
    await deleteSession();
    clearUserMainProfileStore();
    return true;
  } catch (err: Error | unknown) {
    await deleteSession();
    console.log(`Failed to logout user. Reason: ${err}`);
    return {
      status: false,
      error: `${err}`,
    };
  }
};
