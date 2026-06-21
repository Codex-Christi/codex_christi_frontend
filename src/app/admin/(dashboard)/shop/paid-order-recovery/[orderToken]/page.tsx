import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PaidOrderRecoveryDetailPanel from '@/components/UI/Admin/dashboard/PaidOrderRecoveryDetailPanel';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { getAdminPaidOrderRecoveryDetail } from '@/lib/paypal/txLedger/adminPaidOrderRecovery';

type PaidOrderRecoveryDetailPageProps = {
  params: Promise<{ orderToken: string }>;
};

export const metadata: Metadata = {
  title: 'Paid Order Recovery Detail | Codex Christi Admin',
  description: 'Paid order recovery detail workspace for support and admin operations.',
};

export default async function AdminPaidOrderRecoveryDetailPage({
  params,
}: PaidOrderRecoveryDetailPageProps) {
  const { orderToken } = await params;
  await requireAdminPage({
    scope: 'shop.view',
    returnPath: `/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`,
  });

  const recovery = await getAdminPaidOrderRecoveryDetail(orderToken);

  if (!recovery) {
    notFound();
  }

  return (
    <div className='px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
      <section className='mx-auto max-w-[1500px] space-y-4'>
        <Link
          href='/admin/shop/paid-order-recovery'
          className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
        >
          <ArrowLeft size={16} />
          Paid order recovery queue
        </Link>

        <PaidOrderRecoveryDetailPanel
          recovery={recovery.row}
          detail={recovery.detail}
          timeline={recovery.timeline}
          notifications={recovery.notifications.map((notification) => ({
            id: notification.id,
            type: notification.type,
            errorCode: notification.errorCode,
            severity: notification.severity,
            status: notification.status,
            recipient: notification.recipient,
            createdAt: notification.createdAt.toISOString(),
            sentAt: notification.sentAt?.toISOString() ?? null,
            lastErrorMessage: notification.lastErrorMessage,
          }))}
          customerNotifications={recovery.customerNotifications.map((notification) => ({
            id: notification.id,
            type: notification.type,
            status: notification.status,
            recipient: notification.recipient,
            createdAt: notification.createdAt.toISOString(),
            sentAt: notification.sentAt?.toISOString() ?? null,
            lastErrorMessage: notification.lastErrorMessage,
          }))}
          variant='page'
        />
      </section>
    </div>
  );
}
