import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAdminGlassPanelClassName, default as AdminGlassPanel } from './AdminGlassPanel';
import AdminNotificationHistoryPanel from './AdminNotificationHistoryPanel';
import AdminPaidOrderRecoveryActionsPanel from './AdminPaidOrderRecoveryActionsPanel';
import CustomerNotificationHistoryPanel from './CustomerNotificationHistoryPanel';
import {
  PaidOrderRecoveryActivitySection,
  PaidOrderRecoveryPrimaryContextSections,
  PaidOrderRecoverySecondaryContextSections,
} from './PaidOrderRecoveryDetailSections';
import {
  getManualReleaseReadinessWarning,
  PaidOrderRecoveryBlockerPanel,
  PaidOrderRecoveryCaseSummary,
  PaidOrderRecoveryPaymentEvidencePanel,
  PaidOrderRecoveryPostPaymentPipeline,
} from './PaidOrderRecoveryOverviewPanels';
import PaidOrderRecoveryWebhookScannerSummary from './PaidOrderRecoveryWebhookScannerSummary';
import type {
  AdminNotificationHistoryItem,
  CustomerNotificationHistoryItem,
  PaidOrderRecoveryDetail,
  PaidOrderRecoveryRow,
  TimelineItem,
} from './adminShopDashboardTypes';

type PaidOrderRecoveryDetailPanelProps = {
  recovery: PaidOrderRecoveryRow;
  detail: PaidOrderRecoveryDetail;
  timeline?: TimelineItem[];
  notifications?: AdminNotificationHistoryItem[];
  customerNotifications?: CustomerNotificationHistoryItem[];
  onClose?: () => void;
  variant?: 'panel' | 'page';
};

export default function PaidOrderRecoveryDetailPanel({
  recovery,
  detail,
  timeline = [],
  notifications = [],
  customerNotifications = [],
  onClose,
  variant = 'panel',
}: PaidOrderRecoveryDetailPanelProps) {
  const releaseReadinessWarning = getManualReleaseReadinessWarning(detail.merchizeFulfillmentOps);

  return (
    <div
      className={cn(
        'min-w-0',
        variant === 'panel' &&
          getAdminGlassPanelClassName(
            'flex max-h-full min-h-0 flex-col overflow-hidden xl:sticky xl:top-5 xl:min-h-[760px]',
          ),
      )}
    >
      {variant === 'panel' ? (
        <div className='flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4 text-slate-300 sm:px-5'>
          <div className='text-sm font-medium'>Paid Order Recovery</div>
          {onClose ? (
            <button
              type='button'
              aria-label='Close paid order recovery detail'
              onClick={onClose}
              className='rounded-md p-1 text-slate-300 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60'
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'min-w-0 space-y-5',
          variant === 'panel' && 'min-h-0 flex-1 overflow-y-auto p-4 sm:p-5',
        )}
      >
        <div className='flex min-w-0 flex-col gap-4 xl:grid xl:grid-cols-2 xl:items-start'>
          <div className='contents xl:block xl:space-y-4'>
            <section aria-label='Recovery case' className='order-1 min-w-0'>
              <PaidOrderRecoveryCaseSummary recovery={recovery} detail={detail} />
            </section>
            <section aria-label='Post-payment pipeline' className='order-4 min-w-0'>
              <PaidOrderRecoveryPostPaymentPipeline timeline={timeline} detail={detail} />
            </section>
          </div>

          <div className='contents xl:block xl:space-y-4'>
            <section aria-label='Payment evidence' className='order-2 min-w-0'>
              <PaidOrderRecoveryPaymentEvidencePanel recovery={recovery} detail={detail} />
            </section>
            <aside className='order-3 min-w-0 space-y-4 self-start'>
              <PaidOrderRecoveryBlockerPanel recovery={recovery} detail={detail} />
              <div className='xl:sticky xl:top-24'>
                <RecoveryActionsPanel
                  recovery={recovery}
                  detail={detail}
                  manualReleaseReadinessWarning={releaseReadinessWarning}
                />
              </div>
            </aside>
          </div>
        </div>

        <section aria-labelledby='order-fulfillment-heading' className='min-w-0 space-y-4'>
          <SectionHeading
            id='order-fulfillment-heading'
            eyebrow='Order & fulfillment'
            title='Customer, items, and delivery context'
            description='Review the order information that recovery actions are allowed to mutate.'
          />
          <PaidOrderRecoveryPrimaryContextSections
            detail={detail}
            orderToken={recovery.orderToken}
          />
        </section>

        <section
          aria-label='Changes and communications'
          className='grid min-w-0 gap-4 xl:grid-cols-2'
        >
          <PaidOrderRecoveryActivitySection detail={detail} />
          <CommunicationsPanel
            notifications={notifications}
            customerNotifications={customerNotifications}
            orderToken={recovery.orderToken}
          />
        </section>

        <TechnicalDiagnostics detail={detail} />
      </div>
    </div>
  );
}

function RecoveryActionsPanel({
  recovery,
  detail,
  manualReleaseReadinessWarning,
}: {
  recovery: PaidOrderRecoveryRow;
  detail: PaidOrderRecoveryDetail;
  manualReleaseReadinessWarning: string | null;
}) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='border-b border-white/10 px-4 py-4 sm:px-5'>
        <h3 className='text-base font-semibold text-white'>Available actions</h3>
        <p className='mt-1 text-sm leading-6 text-slate-300'>
          Actions continue from durable post-payment checkpoints.
        </p>
      </div>
      <div className='p-4 sm:p-5'>
        <AdminPaidOrderRecoveryActionsPanel
          orderToken={recovery.orderToken}
          isCompleted={recovery.status === 'completed'}
          needsProviderDetailSync={detail.needsProviderDetailSync}
          requiresManualRelease={detail.requiresManualRelease}
          recoveryStatus={recovery.status}
          manualReleaseReadinessWarning={manualReleaseReadinessWarning}
        />
      </div>
    </AdminGlassPanel>
  );
}

function CommunicationsPanel({
  notifications,
  customerNotifications,
  orderToken,
}: {
  notifications: AdminNotificationHistoryItem[];
  customerNotifications: CustomerNotificationHistoryItem[];
  orderToken: string;
}) {
  const failedCount = [...notifications, ...customerNotifications].filter(
    (notification) => notification.status === 'failed',
  ).length;

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <details className='group' open={failedCount > 0}>
        <summary className='flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200/60 sm:px-5'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100'>
              Communications
            </p>
            <h3 className='mt-1 text-base font-semibold text-white'>
              Admin and customer notifications
            </h3>
            <p className='mt-1 text-sm leading-6 text-slate-300'>
              {failedCount
                ? `${failedCount} failed notification${failedCount === 1 ? '' : 's'} needs attention.`
                : `${notifications.length + customerNotifications.length} notification${
                    notifications.length + customerNotifications.length === 1 ? '' : 's'
                  } recorded. Successful history is collapsed.`}
            </p>
          </div>
          <ChevronDown
            size={17}
            className='mt-1 shrink-0 text-slate-300 transition group-open:rotate-180'
          />
        </summary>
        <div className='border-t border-white/10 p-4 sm:p-5'>
          <AdminNotificationHistoryPanel notifications={notifications} orderToken={orderToken} />
          <CustomerNotificationHistoryPanel
            notifications={customerNotifications}
            orderToken={orderToken}
          />
        </div>
      </details>
    </AdminGlassPanel>
  );
}

function TechnicalDiagnostics({ detail }: { detail: PaidOrderRecoveryDetail }) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <details className='group'>
        <summary className='flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200/60 sm:px-5'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.1em] text-slate-300'>
              Advanced
            </p>
            <h3 className='mt-1 text-base font-semibold text-white'>Technical diagnostics</h3>
            <p className='mt-1 text-sm leading-6 text-slate-300'>
              Webhook delivery, scanner eligibility, system identifiers, and raw ledger data.
            </p>
          </div>
          <ChevronDown
            size={17}
            className='mt-1 shrink-0 text-slate-300 transition group-open:rotate-180'
          />
        </summary>
        <div className='space-y-4 border-t border-white/10 p-4 sm:p-5'>
          <PaidOrderRecoveryWebhookScannerSummary detail={detail} embedded />
          <PaidOrderRecoverySecondaryContextSections detail={detail} />
        </div>
      </details>
    </AdminGlassPanel>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className='text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100'>{eyebrow}</p>
      <h2 id={id} className='mt-1 text-xl font-semibold tracking-tight text-white'>
        {title}
      </h2>
      <p className='mt-1 text-sm leading-6 text-slate-300'>{description}</p>
    </div>
  );
}
