'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AdminPaidOrderRecoveryScannerPanel from './dashboard/AdminPaidOrderRecoveryScannerPanel';
import PaidOrderRecoveryQueuePanel from './dashboard/PaidOrderRecoveryQueuePanel';
import type { PaidOrderRecoveryListResult } from './dashboard/adminShopDashboardTypes';
import type { AdminRecoveryScannerActionResult } from '@/app/admin/(dashboard)/shop/paid-order-recovery/actions';
import type { ShopOpsDataTargetView } from '@/lib/prisma/shop/shopOpsDataTarget';
import type { ScheduledRecoveryRunStatus } from '@/lib/paypal/txLedger/scheduledRecoveryRun';
import ShopOpsDataTargetBadge from './dashboard/ShopOpsDataTargetBadge';

type AdminShopPaidOrderRecoveryClientProps = {
  recoveryList: PaidOrderRecoveryListResult;
  latestScannerRun: AdminRecoveryScannerActionResult['scan'] | null;
  scheduledRun: ScheduledRecoveryRunStatus;
  shopOpsDataTarget: ShopOpsDataTargetView;
};

export default function AdminShopPaidOrderRecoveryClient({
  recoveryList,
  latestScannerRun,
  scheduledRun,
  shopOpsDataTarget,
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

        <ShopOpsDataTargetBadge status={shopOpsDataTarget} />

        <AdminPaidOrderRecoveryScannerPanel initialScan={latestScannerRun} scheduledRun={scheduledRun} />

        <PaidOrderRecoveryQueuePanel
          mobileMode='full-list'
          rows={recoveryList.rows}
          filters={recoveryList.filters}
          pagination={recoveryList.pagination}
        />
      </section>
    </div>
  );
}
