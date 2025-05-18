// app/api/logout/route.ts
import { NextRequest } from 'next/server';
import { decrypt, deleteSession, getCookie } from '@/lib/session/main-session';
import axios from 'axios';
import { basicRedirect } from '@/lib/session/session-redirect';
import { clearUserMainProfileStore } from '@/stores/userMainProfileStore';
import { redirect } from 'next/navigation';

const axiosClient = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_BASE_URL}`,
});

export async function GET(req: NextRequest) {
  const host = req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const redirectUrl = `${protocol}://${host}/auth/sign-in?from-logout=true`;

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
    clearUserMainProfileStore();
    await deleteSession(); // allowed here
    redirect(`${redirectUrl}`);
  } catch (err: Error | unknown) {
    await deleteSession();
    console.log(`Failed to logout user. Reason: ${err}`);
    redirect(`${redirectUrl}`);
  }
}
