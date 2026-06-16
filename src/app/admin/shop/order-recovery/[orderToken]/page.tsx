import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import AdminShopShell from '@/components/UI/Admin/AdminShopShell';
import OrderRecoveryDetailPanel from '@/components/UI/Admin/dashboard/OrderRecoveryDetailPanel';
import CometsContainer from '@/components/UI/general/CometsContainer';
import { getAdminOrderRecoveryDetail } from '@/lib/paypal/txLedger/adminOrderRecovery';

type OrderRecoveryDetailPageProps = {
  params: Promise<{ orderToken: string }>;
};

export async function generateMetadata({
  params,
}: OrderRecoveryDetailPageProps): Promise<Metadata> {
  const { orderToken } = await params;
  const recovery = await getAdminOrderRecoveryDetail(orderToken);

  return {
    title: recovery?.row
      ? `${recovery.row.supportRef} | Order Recovery | Codex Christi Admin`
      : 'Order Recovery Detail | Codex Christi Admin',
    description: 'Order recovery detail workspace for support and admin operations.',
  };
}

export default async function AdminOrderRecoveryDetailPage({
  params,
}: OrderRecoveryDetailPageProps) {
  const { orderToken } = await params;
  const recovery = await getAdminOrderRecoveryDetail(orderToken);

  if (!recovery) {
    notFound();
  }

  return (
    <CometsContainer>
      <AdminShopShell
        scope='shop-order-recovery'
        title='Order Recovery Detail'
        subtitle='Inspect timeline, provider state, failure context, and admin recovery actions'
      >
        <div className='px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
          <section className='mx-auto max-w-[1500px] space-y-4'>
            <Link
              href='/admin/shop/order-recovery'
              className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
            >
              <ArrowLeft size={16} />
              Order recovery queue
            </Link>

            <OrderRecoveryDetailPanel
              recovery={recovery.row}
              timeline={recovery.timeline}
              notifications={recovery.notifications.map((notification) => ({
                id: notification.id,
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
      </AdminShopShell>
    </CometsContainer>
  );
}
