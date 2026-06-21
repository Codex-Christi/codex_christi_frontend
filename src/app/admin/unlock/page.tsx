import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AdminUnlockForm from '@/components/UI/Admin/AdminUnlockForm';
import AdminAmbientSlideshow from '@/components/UI/Admin/dashboard/AdminAmbientSlideshow';
import AdminGlassPanel from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import CometsContainer from '@/components/UI/general/CometsContainer';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import { buildAdminLogoutPath, sanitizeAdminReturnPath } from '@/lib/admin/admin-paths';
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
  const adminUser = await requirePrimaryAdminCandidate({
    returnPath: `/admin/unlock?next=${encodeURIComponent(nextPath)}`,
  });
  const adminSession = await getServerAdminSessionState();

  if (adminSession.shouldClearCookie) {
    redirect(buildAdminLogoutPath(nextPath));
  }

  if (
    adminSession.isAuthenticated &&
    adminSession.userID === adminUser.codexUserId &&
    adminSession.sessionVersion === adminUser.sessionVersion
  ) {
    redirect(nextPath);
  }

  return (
    <DefaultPageWrapper hasMainNav>
      <CometsContainer>
        <main className='relative isolate grid min-h-dvh overflow-hidden place-items-center bg-[#141923] px-4 py-24 text-slate-50'>
          <AdminAmbientSlideshow />
          <AdminGlassPanel className='relative z-10 w-full max-w-[520px] p-5 sm:p-7'>
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
          </AdminGlassPanel>
        </main>
      </CometsContainer>
    </DefaultPageWrapper>
  );
}
