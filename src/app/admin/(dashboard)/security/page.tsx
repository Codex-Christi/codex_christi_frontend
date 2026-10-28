import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/admin/require-admin';
import AdminPasswordChangeForm from '@/components/UI/Admin/AdminPasswordChangeForm';

export const metadata: Metadata = { title: 'Admin Password | Codex Christi' };

export default async function AdminSecurityPage() {
  await requireAdminPage({ returnPath: '/admin/security' });
  return (
    <section className='mx-auto grid w-full max-w-3xl gap-6 px-4 py-6 sm:px-6'>
      <h1 className='text-xl font-semibold text-white'>Admin unlock password</h1>
      <AdminPasswordChangeForm />
    </section>
  );
}
