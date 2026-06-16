'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminShopShell from './AdminShopShell';
import OrderRecoveryQueuePanel from './dashboard/OrderRecoveryQueuePanel';
import type { OrderRecoveryRow } from './dashboard/adminShopDashboardTypes';

type AdminShopOrderRecoveryClientProps = {
  rows: OrderRecoveryRow[];
};

export default function AdminShopOrderRecoveryClient({ rows }: AdminShopOrderRecoveryClientProps) {
  return (
    <AdminShopShell
      scope='shop-order-recovery'
      title='Order Recovery'
      subtitle='Provider-neutral queue for paid, paused, failed, and recoverable orders'
    >
      <div className='px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
        <section className='mx-auto max-w-[1600px] space-y-4'>
          <Link
            href='/admin/shop'
            className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
          >
            <ArrowLeft size={16} />
            Shop dashboard
          </Link>

          <OrderRecoveryQueuePanel mobileMode='full-list' rows={rows} />
        </section>
      </div>
    </AdminShopShell>
  );
}
