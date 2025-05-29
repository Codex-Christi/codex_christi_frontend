// app/api/logout/route.ts
import { NextRequest } from 'next/server';
import { decrypt, deleteSession, getCookie } from '@/lib/session/main-session';
import axios from 'axios';
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
    // Get the refresh token from cookies
    // and decrypt it to get the main refresh token
    const refreshToken = await getCookie('refreshToken');

    const decryptRefreshToken = await decrypt(refreshToken?.value);

    const mainRefreshToken = decryptRefreshToken
      ? (decryptRefreshToken.mainRefreshToken as string)
      : ('' as string);
    await axiosClient.post('/auth/user-logout', { refresh: mainRefreshToken });
    clearUserMainProfileStore();
    await deleteSession(); // allowed here
    redirect(`${redirectUrl}`);
  } catch (err: Error | unknown) {
    await deleteSession();
    console.log(`Failed to logout user. Reason: ${err}`);
    redirect(`${redirectUrl}`);
  }
}
