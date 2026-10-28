import { NextResponse } from 'next/server';
import { isSameOriginMutation } from '@/lib/auth/request-origin';
import { clearAdminSessionCookie } from '@/lib/admin/admin-session-cookies';

const headers = { 'Cache-Control': 'private, no-store' };

export async function POST(request: Request) {
  if (!isSameOriginMutation(request))
    return NextResponse.json(
      { success: false, error: 'Request not allowed.' },
      { status: 403, headers },
    );
  return clearAdminSessionCookie(NextResponse.json({ success: true }, { headers }));
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'Use the Lock admin button.' },
    {
      status: 405,
      headers: { ...headers, Allow: 'POST' },
    },
  );
}
