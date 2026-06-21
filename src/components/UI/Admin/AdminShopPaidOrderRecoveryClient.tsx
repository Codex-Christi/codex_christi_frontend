'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminPaidOrderRecoveryScannerPanel from './dashboard/AdminPaidOrderRecoveryScannerPanel';
import PaidOrderRecoveryQueuePanel from './dashboard/PaidOrderRecoveryQueuePanel';
import type { PaidOrderRecoveryRow } from './dashboard/adminShopDashboardTypes';

type AdminShopPaidOrderRecoveryClientProps = {
  rows: PaidOrderRecoveryRow[];
};

export default function AdminShopPaidOrderRecoveryClient({
  rows,
}: AdminShopPaidOrderRecoveryClientProps) {
  return (
    <div className='px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
      <section className='mx-auto max-w-[1600px] space-y-4'>
        <Link
          href='/admin/shop'
          className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
        >
          <ArrowLeft size={16} />
          Shop dashboard
        </Link>

        <AdminPaidOrderRecoveryScannerPanel />

        <PaidOrderRecoveryQueuePanel mobileMode='full-list' rows={rows} />
      </section>
    </div>
  );
}
