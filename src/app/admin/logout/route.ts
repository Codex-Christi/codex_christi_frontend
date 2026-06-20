import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { buildAdminUnlockPath, sanitizeAdminReturnPath } from '@/lib/admin/admin-paths';
import { deleteAdminSession } from '@/lib/admin/admin-session-server';

export async function GET(request: NextRequest) {
  const nextPath = sanitizeAdminReturnPath(request.nextUrl.searchParams.get('next'), '/admin');

  await deleteAdminSession();
  redirect(buildAdminUnlockPath(nextPath));
}
