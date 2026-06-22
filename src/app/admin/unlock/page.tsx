import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminUnlockForm from '@/components/UI/Admin/AdminUnlockForm';
import AdminAmbientSlideshow from '@/components/UI/Admin/dashboard/AdminAmbientSlideshow';
import AdminGlassPanel from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import { isAdminOpsLedgerUnavailableError } from '@/lib/admin/admin-ops-ledger-errors';
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
  }).catch((error) => {
    if (isAdminOpsLedgerUnavailableError(error)) {
      return null;
    }

    throw error;
  });

  if (!adminUser) {
    return <AdminUnlockUnavailableState />;
  }

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
    </DefaultPageWrapper>
  );
}

function AdminUnlockUnavailableState() {
  return (
    <DefaultPageWrapper hasMainNav>
      <main className='relative isolate grid min-h-dvh overflow-hidden place-items-center bg-[#141923] px-4 py-24 text-slate-50'>
        <AdminAmbientSlideshow />
        <AdminGlassPanel className='relative z-10 w-full max-w-[560px] p-5 sm:p-7'>
          <div className='space-y-3'>
            <p className='text-xs font-semibold uppercase tracking-[0.18em] text-amber-200'>
              Admin Ops Ledger
            </p>
            <h1 className='text-2xl font-semibold tracking-normal text-white'>
              Admin auth is temporarily unavailable
            </h1>
            <p className='text-sm leading-6 text-slate-300'>
              Codex Christi can reach your primary session, but the Admin Ops Ledger database did
              not answer the admin lookup. Check the Neon Admin Ops project and retry after the
              database is reachable.
            </p>
          </div>
          <div className='mt-6 flex flex-wrap gap-2'>
            <Link
              href='/admin'
              className='inline-flex h-10 items-center justify-center rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200'
            >
              Retry Admin
            </Link>
            <Link
              href='/'
              className='inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
            >
              Return Home
            </Link>
          </div>
        </AdminGlassPanel>
      </main>
    </DefaultPageWrapper>
  );
}
