'use client';

import { useReducedMotion } from 'framer-motion';
import AdminShell from './AdminShell';
import AdminMetricCard from './dashboard/AdminMetricCard';
import OrderRecoveryQueuePanel from './dashboard/OrderRecoveryQueuePanel';
import { adminMetricCards } from './dashboard/adminDashboardData';
import type { AdminScope } from './dashboard/adminDashboardTypes';

type AdminDashboardClientProps = {
  scope: AdminScope;
};

export default function AdminDashboardClient({ scope }: AdminDashboardClientProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AdminShell
      scope={scope}
      title='Shop Operations'
      subtitle='Payments, recovery, fulfillment, and shop support tooling'
    >
      <div className='grid gap-4 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:gap-5 sm:px-5'>
        <section className='min-w-0 space-y-5'>
          <div className='grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {adminMetricCards.map((card, index) => (
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
    </AdminShell>
  );
}
