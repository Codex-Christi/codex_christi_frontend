// app/api/logout/route.ts
import { NextRequest } from 'next/server';
import { deleteSession } from '@/lib/session/main-session';
import { getServerRefreshToken } from '@/lib/session/server-session';
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
    const mainRefreshToken = await getServerRefreshToken();

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
