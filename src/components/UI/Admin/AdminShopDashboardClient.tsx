'use client';

import { useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  Store,
  Webhook,
} from 'lucide-react';
import AdminMetricCard from './dashboard/AdminMetricCard';
import AdminGlassPanel from './dashboard/AdminGlassPanel';
import PaidOrderRecoveryQueuePanel from './dashboard/PaidOrderRecoveryQueuePanel';
import type { MetricCard, PaidOrderRecoveryRow } from './dashboard/adminShopDashboardTypes';

type PayPalWebhookSafetyWarning = {
  code: string;
  message: string;
  severity: 'critical' | 'warning';
};

type AdminShopDashboardClientProps = {
  paymentReconciliationAttentionCount?: number;
  paymentReconciliationCriticalCount?: number;
  paymentReconciliationWarningCount?: number;
  paypalWebhookActiveDbCount?: number;
  paypalWebhookAttentionCount?: number;
  paypalWebhookSafetyWarnings?: PayPalWebhookSafetyWarning[];
  recoveryRows: PaidOrderRecoveryRow[];
};

export default function AdminShopDashboardClient({
  paymentReconciliationAttentionCount = 0,
  paymentReconciliationCriticalCount = 0,
  paymentReconciliationWarningCount = 0,
  paypalWebhookActiveDbCount = 0,
  paypalWebhookAttentionCount = 0,
  paypalWebhookSafetyWarnings = [],
  recoveryRows,
}: AdminShopDashboardClientProps) {
  const reduceMotion = useReducedMotion();
  const metricCards = getImplementedShopMetricCards({
    paymentReconciliationAttentionCount,
    paymentReconciliationCriticalCount,
    paymentReconciliationWarningCount,
    paypalWebhookActiveDbCount,
    paypalWebhookAttentionCount,
    recoveryRows,
  });

  return (
    <div className='grid gap-4 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:gap-5 sm:px-5'>
      <section className='min-w-0 space-y-5'>
        {paypalWebhookSafetyWarnings.length ? (
          <AdminGlassPanel className='border-amber-300/20 bg-amber-300/[0.04] p-4'>
            <div className='flex items-start gap-3'>
              <span className='mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-300/25 bg-amber-300/10 text-amber-100'>
                <AlertTriangle size={17} />
              </span>
              <div className='min-w-0'>
                <p className='text-sm font-semibold text-white'>PayPal webhook safety warning</p>
                <div className='mt-2 space-y-1 text-sm leading-6 text-slate-300'>
                  {paypalWebhookSafetyWarnings.slice(0, 3).map((warning) => (
                    <p key={warning.code}>{warning.message}</p>
                  ))}
                </div>
              </div>
            </div>
          </AdminGlassPanel>
        ) : null}

        <div className='grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {metricCards.map((card, index) => (
            <AdminMetricCard
              key={card.title}
              card={card}
              index={index}
              reduceMotion={Boolean(reduceMotion)}
            />
          ))}
        </div>

        <PaidOrderRecoveryQueuePanel mobileMode='summary-link' rows={recoveryRows} />
      </section>
    </div>
  );
}

function getImplementedShopMetricCards({
  paymentReconciliationAttentionCount,
  paymentReconciliationCriticalCount,
  paymentReconciliationWarningCount,
  paypalWebhookActiveDbCount,
  paypalWebhookAttentionCount,
  recoveryRows,
}: {
  paymentReconciliationAttentionCount: number;
  paymentReconciliationCriticalCount: number;
  paymentReconciliationWarningCount: number;
  paypalWebhookActiveDbCount: number;
  paypalWebhookAttentionCount: number;
  recoveryRows: PaidOrderRecoveryRow[];
}): MetricCard[] {
  const failedRows = recoveryRows.filter((row) => row.status === 'failed');
  const recoveryQueueRows = recoveryRows.filter((row) =>
    ['failed', 'recovery', 'pending', 'sync', 'attention'].includes(row.status),
  );
  const providerSyncRows = recoveryRows.filter(
    (row) => row.status === 'sync' || row.needsProviderDetailSync,
  );

  return [
    {
      title: 'Paid Order Recovery',
      metric: `${recoveryRows.length}`,
      caption: `${recoveryQueueRows.length} active rows`,
      action: 'Open Recovery Queue',
      href: '/admin/shop/paid-order-recovery',
      icon: ClipboardList,
      state: recoveryQueueRows.length ? 'action' : 'healthy',
      tone: recoveryQueueRows.length ? 'amber' : 'emerald',
    },
    {
      title: 'Failed Recovery Rows',
      metric: `${failedRows.length}`,
      caption: failedRows.length ? 'needs admin action' : 'no failures',
      action: 'Review Failed Rows',
      href: '/admin/shop/paid-order-recovery',
      icon: PackageCheck,
      state: failedRows.length ? 'critical' : 'healthy',
      tone: failedRows.length ? 'rose' : 'emerald',
    },
    {
      title: 'Provider Sync',
      metric: `${providerSyncRows.length}`,
      caption: providerSyncRows.length ? 'provider details needed' : 'queue in sync',
      action: 'Open Recovery Details',
      href: '/admin/shop/paid-order-recovery',
      icon: RefreshCw,
      state: providerSyncRows.length ? 'review' : 'healthy',
      tone: providerSyncRows.length ? 'cyan' : 'emerald',
    },
    {
      title: 'PayPal Reconciliation',
      metric: `${paymentReconciliationAttentionCount}`,
      caption: paymentReconciliationCriticalCount
        ? `${paymentReconciliationCriticalCount} critical`
        : paymentReconciliationWarningCount
          ? `${paymentReconciliationWarningCount} warning`
          : 'no payment attention',
      action: 'Open Reconciliation',
      href: '/admin/shop/paypal-reconciliation',
      icon: BarChart3,
      state: paymentReconciliationCriticalCount
        ? 'critical'
        : paymentReconciliationAttentionCount
          ? 'review'
          : 'healthy',
      tone: paymentReconciliationCriticalCount
        ? 'rose'
        : paymentReconciliationAttentionCount
          ? 'amber'
          : 'emerald',
    },
    {
      title: 'PayPal Webhooks',
      metric: `${paypalWebhookAttentionCount}`,
      caption: paypalWebhookAttentionCount
        ? 'env update needed'
        : paypalWebhookActiveDbCount
          ? `${paypalWebhookActiveDbCount} active DB`
          : 'env-managed trust',
      action: 'Open Webhooks',
      href: '/admin/shop/paypal-webhooks',
      icon: Webhook,
      state: paypalWebhookAttentionCount ? 'review' : 'healthy',
      tone: paypalWebhookAttentionCount ? 'amber' : 'emerald',
    },
    {
      title: 'Catalog & Snapshots',
      metric: 'Open',
      caption: 'catalog and storefront fallback',
      action: 'Open Catalog Tool',
      href: '/admin/shop/merchize-catalog-snapshots',
      icon: Store,
      state: 'ready',
      tone: 'cyan',
    },
  ];
}
