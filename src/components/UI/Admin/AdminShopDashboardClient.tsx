'use client';

import { useReducedMotion } from 'framer-motion';
import AdminShopShell from './AdminShopShell';
import AdminMetricCard from './dashboard/AdminMetricCard';
import OrderRecoveryQueuePanel from './dashboard/OrderRecoveryQueuePanel';
import { adminShopMetricCards } from './dashboard/adminShopDashboardData';
import type { AdminShopScope } from './dashboard/adminShopDashboardTypes';

type AdminShopDashboardClientProps = {
  scope: AdminShopScope;
};

export default function AdminShopDashboardClient({ scope }: AdminShopDashboardClientProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AdminShopShell
      scope={scope}
      title='Shop Operations'
      subtitle='Payments, recovery, fulfillment, and shop support tooling'
    >
      <div className='grid gap-4 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:gap-5 sm:px-5'>
        <section className='min-w-0 space-y-5'>
          <div className='grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {adminShopMetricCards.map((card, index) => (
              <AdminMetricCard
                key={card.title}
                card={card}
                index={index}
                reduceMotion={Boolean(reduceMotion)}
              />
            ))}
          </div>

          <OrderRecoveryQueuePanel mobileMode='summary-link' />
        </section>
      </div>
    </AdminShopShell>
  );
}
