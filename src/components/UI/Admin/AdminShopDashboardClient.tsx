'use client';

import { useReducedMotion } from 'framer-motion';
import AdminMetricCard from './dashboard/AdminMetricCard';
import PaidOrderRecoveryQueuePanel from './dashboard/PaidOrderRecoveryQueuePanel';
import { adminShopMetricCards } from './dashboard/adminShopDashboardData';

type AdminShopDashboardClientProps = {
  paymentReconciliationAttentionCount?: number;
  paymentReconciliationCriticalCount?: number;
};

export default function AdminShopDashboardClient({
  paymentReconciliationAttentionCount = 0,
  paymentReconciliationCriticalCount = 0,
}: AdminShopDashboardClientProps) {
  const reduceMotion = useReducedMotion();
  const metricCards = adminShopMetricCards.map((card) => {
    if (card.title !== 'Reconciliation') return card;

    return {
      ...card,
      metric: `${paymentReconciliationAttentionCount}`,
      caption: paymentReconciliationCriticalCount
        ? `${paymentReconciliationCriticalCount} critical`
        : 'Payment attention',
      state: paymentReconciliationCriticalCount ? ('critical' as const) : card.state,
      tone: paymentReconciliationCriticalCount ? ('rose' as const) : card.tone,
    };
  });

  return (
    <div className='grid gap-4 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:gap-5 sm:px-5'>
      <section className='min-w-0 space-y-5'>
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

        <PaidOrderRecoveryQueuePanel mobileMode='summary-link' />
      </section>
    </div>
  );
}
