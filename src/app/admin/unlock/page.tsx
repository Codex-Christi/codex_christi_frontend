import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AdminUnlockForm from '@/components/UI/Admin/AdminUnlockForm';
import CometsContainer from '@/components/UI/general/CometsContainer';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import { sanitizeAdminReturnPath } from '@/lib/admin/admin-paths';
import { getServerAdminSessionState } from '@/lib/admin/admin-session-server';
import { requirePrimaryAdminCandidate } from '@/lib/admin/require-admin';

export const metadata: Metadata = {
  title: 'Admin Unlock | Codex Christi',
};

type AdminUnlockPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function AdminUnlockPage({ searchParams }: AdminUnlockPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeAdminReturnPath(params.next, '/admin');
  const { userID } = await requirePrimaryAdminCandidate({
    returnPath: `/admin/unlock?next=${encodeURIComponent(nextPath)}`,
  });
  const adminSession = await getServerAdminSessionState();

  if (adminSession.isAuthenticated && adminSession.userID === userID) {
    redirect(nextPath);
  }

  return (
    <DefaultPageWrapper hasMainNav>
      <CometsContainer>
        <main className='grid min-h-dvh place-items-center px-4 py-24 text-slate-50'>
          <section className='w-full max-w-[520px] rounded-lg border border-white/10 bg-slate-950/72 p-5 shadow-2xl shadow-black/30 supports-[backdrop-filter]:backdrop-blur-xl sm:p-7'>
            <div className='mb-7 space-y-2'>
              <p className='text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200'>
                Codex Christi Admin
              </p>
              <h1 className='text-2xl font-semibold tracking-normal text-white'>
                Admin access required
              </h1>
              <p className='text-sm leading-6 text-slate-300'>
                Your primary session is active. Unlock admin tools to continue.
              </p>
            </div>

            <AdminUnlockForm nextPath={nextPath} />
          </section>
        </main>
      </CometsContainer>
    </DefaultPageWrapper>
  );
}
