import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import AdminTransferAcceptanceForm, {
  AdminTransferSwitchAccount,
} from '@/components/UI/Admin/AdminTransferAcceptanceForm';
import AdminAmbientSlideshow from '@/components/UI/Admin/dashboard/AdminAmbientSlideshow';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import { getServerSessionState } from '@/lib/session/server-session';
import { getRecipientTransferInvitation } from '@/lib/admin/admin-master-transfer';
import { adminTransferIdSchema } from '@/lib/formSchemas/admin-transfer';
import {
  ADMIN_TRANSFER_ACCEPT_PATH,
  buildAdminTransferAcceptancePath,
} from '@/lib/admin/admin-paths';
import { authFlowUrl } from '@/lib/auth/domain-routing';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Accept Admin Ownership | Codex Christi',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function AcceptAdminOwnershipPage({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string | string[] }>;
}) {
  const parsed = adminTransferIdSchema.safeParse((await searchParams).invitation);
  const returnPath = parsed.success
    ? buildAdminTransferAcceptancePath(parsed.data)
    : ADMIN_TRANSFER_ACCEPT_PATH;
  const primary = await getServerSessionState();
  if (!primary.isAuthenticated || !primary.userID)
    redirect(authFlowUrl('/auth/sign-in', { next: returnPath }));
  let temporaryFailure = false;
  const invite = parsed.success
    ? await getRecipientTransferInvitation(parsed.data, primary.userID).catch(() => {
        temporaryFailure = true;
        console.warn('[admin-transfer] Invitation lookup temporarily unavailable');
        return null;
      })
    : null;
  return (
    <DefaultPageWrapper hasMainNav>
      <main className='relative isolate grid min-h-dvh place-items-center overflow-hidden bg-[#141923] px-4 py-24 text-slate-50'>
        <AdminAmbientSlideshow />
        <div className='relative z-10 w-full max-w-[520px] space-y-6'>
          <header className='space-y-3'>
            <ShieldCheck size={28} className='text-cyan-200' aria-hidden />
            <h1 className='text-2xl font-semibold text-white'>Accept Admin Ownership</h1>
          </header>
          {invite ? (
            <>
              <dl className='space-y-2 border-y border-white/15 py-4 text-sm'>
                <div>
                  <dt className='text-slate-400'>Invited account</dt>
                  <dd className='break-all'>{invite.targetCodexUserId}</dd>
                </div>
                <div>
                  <dt className='text-slate-400'>Invitation sent to</dt>
                  <dd className='break-all'>{invite.targetEmailHint}</dd>
                </div>
                <div>
                  <dt className='text-slate-400'>Expires</dt>
                  <dd>
                    <time dateTime={invite.expiresAt.toISOString()}>
                      {invite.expiresAt.toLocaleString('en-US', { timeZone: 'UTC' })} UTC
                    </time>
                  </dd>
                </div>
              </dl>
              <AdminTransferAcceptanceForm challengeId={invite.challengeId} />
            </>
          ) : (
            <div className='space-y-5'>
              <p role='status' className='text-sm leading-6 text-slate-200'>
                {temporaryFailure
                  ? 'Invitations are temporarily unavailable. Please try again shortly.'
                  : 'This invitation is unavailable for this account. Check the link, account and expiry.'}
              </p>
              {temporaryFailure ? (
                <a
                  href={returnPath}
                  className='inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm'
                >
                  <RotateCcw size={16} /> Retry
                </a>
              ) : null}
              {parsed.success ? <AdminTransferSwitchAccount challengeId={parsed.data} /> : null}
              <Link href='/profile' className='flex min-h-10 items-center text-sm text-cyan-200'>
                Return To Profile
              </Link>
            </div>
          )}
        </div>
      </main>
    </DefaultPageWrapper>
  );
}
