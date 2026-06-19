import { redirect } from 'next/navigation';
import { deleteAdminSession } from '@/lib/admin/admin-session-server';

export async function GET() {
  await deleteAdminSession();
  redirect('/admin/unlock?next=%2Fadmin');
}

