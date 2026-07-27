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
import PaidOrderRecoveryHistoryDialog from './PaidOrderRecoveryHistoryDialog';
import {
  getManualReleaseReadinessWarning,
  PaidOrderRecoveryBlockerPanel,
  PaidOrderRecoveryCaseSummary,
  PaidOrderRecoveryFulfillmentEvidenceSection,
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
            <section
              aria-labelledby='order-fulfillment-heading'
              className='order-6 min-w-0 space-y-4'
            >
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

          <section
            aria-label='Provider readiness evidence'
            className='order-5 min-w-0 xl:col-span-2'
          >
            <PaidOrderRecoveryFulfillmentEvidenceSection detail={detail} />
          </section>
        </div>

        <section
          aria-label='Changes and communications'
          className='grid min-w-0 items-start gap-4 xl:grid-cols-2'
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
  const addressReviewStatus = detail.merchizeFulfillmentOps?.addressReviewStatus;
  const canConfirmProviderAddress =
    Boolean(detail.merchizeFulfillmentOps?.merchizeOrderId) &&
    ['blocked', 'pending', 'provider_update_pending_validation'].includes(
      addressReviewStatus ?? '',
    );

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
          canConfirmProviderAddress={canConfirmProviderAddress}
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
  const totalCount = notifications.length + customerNotifications.length;
  const failedCount = [...notifications, ...customerNotifications].filter(
    (notification) => notification.status === 'failed',
  ).length;

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='px-4 py-4 sm:px-5'>
        <p className='text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100'>
          Communications
        </p>
        <h3 className='mt-1 text-base font-semibold text-white'>
          Admin and customer notifications
        </h3>
        <p className='mt-1 text-sm leading-6 text-slate-300'>
          {failedCount
            ? `${formatCount(failedCount, 'failed notification')} ${
                failedCount === 1 ? 'needs' : 'need'
              } attention.`
            : totalCount
              ? 'Delivery status and retry actions are available in the notification history.'
              : 'No notification history has been recorded for this order.'}
        </p>

        <div className='mt-3 flex flex-wrap gap-2'>
          <SummaryBadge label={formatCount(notifications.length, 'admin notification')} />
          <SummaryBadge
            label={formatCount(customerNotifications.length, 'customer notification')}
          />
          {failedCount ? <SummaryBadge label={`${failedCount} failed`} tone='rose' /> : null}
        </div>

        {failedCount ? (
          <p className='mt-4 rounded-lg border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2.5 text-sm leading-5 text-rose-100'>
            Review the failure reason before retrying or suppressing a notification.
          </p>
        ) : null}

        {totalCount ? (
          <div className='mt-4 flex justify-end'>
            <PaidOrderRecoveryHistoryDialog
              triggerLabel={`View ${formatCount(totalCount, 'notification')}`}
              title='Notification history'
              description='Delivery status, recipients, failure details, and available retry actions.'
            >
              <section>
                <h4 className='mb-3 text-sm font-semibold text-slate-200'>Admin notifications</h4>
                <AdminNotificationHistoryPanel
                  notifications={notifications}
                  orderToken={orderToken}
                />
              </section>
              <CustomerNotificationHistoryPanel
                notifications={customerNotifications}
                orderToken={orderToken}
              />
            </PaidOrderRecoveryHistoryDialog>
          </div>
        ) : null}
      </div>
    </AdminGlassPanel>
  );
}

function TechnicalDiagnostics({ detail }: { detail: PaidOrderRecoveryDetail }) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <details className='group'>
        <summary className='flex cursor-pointer list-none flex-col gap-4 px-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200/60 sm:flex-row sm:items-start sm:justify-between sm:px-5'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.1em] text-slate-300'>
              Advanced
            </p>
            <h3 className='mt-1 text-base font-semibold text-white'>Technical diagnostics</h3>
            <p className='mt-1 text-sm leading-6 text-slate-300'>
              Webhook delivery, scanner eligibility, system identifiers, and raw ledger data.
            </p>
            <div className='mt-3 flex flex-wrap gap-2'>
              <SummaryBadge label={formatCount(detail.webhookEvents.length, 'webhook event')} />
              <SummaryBadge label={formatCount(detail.references.length, 'reference')} />
              <SummaryBadge
                label={detail.scannerState.eligible ? 'Scanner candidate' : 'Not a candidate'}
                tone={detail.scannerState.eligible ? 'amber' : 'slate'}
              />
            </div>
          </div>
          <span className='inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition group-hover:border-white/20 group-hover:bg-white/[0.07]'>
            <span className='group-open:hidden'>Show diagnostics</span>
            <span className='hidden group-open:inline'>Hide diagnostics</span>
            <ChevronDown
              size={15}
              aria-hidden='true'
              className='transition group-open:rotate-180'
            />
          </span>
        </summary>
        <div className='space-y-4 border-t border-white/10 p-4 sm:p-5'>
          <PaidOrderRecoveryWebhookScannerSummary detail={detail} embedded />
          <PaidOrderRecoverySecondaryContextSections detail={detail} />
        </div>
      </details>
    </AdminGlassPanel>
  );
}

function SummaryBadge({
  label,
  tone = 'slate',
}: {
  label: string;
  tone?: 'slate' | 'amber' | 'rose';
}) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium',
        tone === 'slate' && 'border-white/10 bg-white/[0.035] text-slate-300',
        tone === 'amber' && 'border-amber-300/25 bg-amber-300/[0.1] text-amber-100',
        tone === 'rose' && 'border-rose-300/25 bg-rose-300/[0.1] text-rose-100',
      )}
    >
      {label}
    </span>
  );
}

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
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
