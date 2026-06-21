import { ArrowDownLeft, ArrowLeft, ArrowRight, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminGlassPanel from './AdminGlassPanel';
import AdminNotificationHistoryPanel from './AdminNotificationHistoryPanel';
import AdminPaidOrderRecoveryActionsPanel from './AdminPaidOrderRecoveryActionsPanel';
import { AdminPaidOrderRecoveryStatusBadge } from './AdminStatusBadge';
import CustomerNotificationHistoryPanel from './CustomerNotificationHistoryPanel';
import {
  PaidOrderRecoveryActivitySection,
  PaidOrderRecoveryPrimaryContextSections,
  PaidOrderRecoverySecondaryContextSections,
} from './PaidOrderRecoveryDetailSections';
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
  return (
    <AdminGlassPanel
      className={cn(
        'flex min-h-0 flex-col overflow-hidden',
        variant === 'panel' ? 'max-h-full xl:sticky xl:top-5 xl:min-h-[760px]' : 'min-h-[620px]',
      )}
    >
      <div className='flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4 text-slate-400 sm:px-5'>
        <div className='flex items-center gap-2 text-sm'>
          <ArrowLeft size={16} />
          {variant === 'page' ? 'Paid Order Recovery Detail' : 'Paid Order Recovery'}
        </div>
        {onClose ? (
          <div className='flex items-center gap-4'>
            <ArrowLeft size={16} />
            <ArrowRight size={16} />
            <button
              type='button'
              aria-label='Close paid order recovery detail'
              onClick={onClose}
              className='rounded-md text-slate-400 transition hover:text-white'
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
      </div>

      <div className='min-h-0 flex-1 space-y-4 overflow-visible p-4 sm:p-5'>
        <section className='grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]'>
          <div className='rounded-xl border border-white/10 bg-white/[0.025] p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div>
                <p className='text-xs uppercase tracking-[0.12em] text-slate-500'>
                  Support reference
                </p>
                <h2 className='mt-2 text-2xl font-semibold text-white'>{recovery.supportRef}</h2>
                <p className='mt-2 text-sm text-slate-400'>{detail.customerEmail}</p>
              </div>
              <AdminPaidOrderRecoveryStatusBadge status={recovery.status} />
            </div>

            <div className='mt-5 grid gap-3 sm:grid-cols-3'>
              <SummaryStat label='Paid amount' value={recovery.amount} />
              <SummaryStat label='Payment rail' value='PayPal' />
              <SummaryStat label='Current step' value={recovery.step} />
            </div>
          </div>

          <div className='rounded-xl border border-rose-300/12 bg-rose-300/[0.035] p-4'>
            <p className='text-xs uppercase tracking-[0.12em] text-rose-200'>Last error</p>
            <div className='mt-3 flex items-start gap-2'>
              <span className='mt-1.5 h-2 w-2 rounded-full bg-rose-400' />
              <div>
                <p className='text-sm font-medium text-slate-100'>{recovery.error}</p>
                <p className='mt-2 text-xs leading-5 text-slate-500'>
                  Review the order context before retrying this paid order.
                </p>
              </div>
            </div>
          </div>
        </section>

        <PaidOrderRecoveryWebhookScannerSummary detail={detail} />

        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]'>
          <div className='space-y-4'>
            <TimelinePanel timeline={timeline} />
            <PaidOrderRecoveryPrimaryContextSections
              detail={detail}
              orderToken={recovery.orderToken}
            />
            <PaidOrderRecoveryActivitySection detail={detail} />
            <NotificationsPanel
              notifications={notifications}
              customerNotifications={customerNotifications}
              orderToken={recovery.orderToken}
            />
          </div>

          <div className='space-y-4'>
            <RecoveryActionsPanel recovery={recovery} detail={detail} />
            <PaidOrderRecoverySecondaryContextSections detail={detail} />
          </div>
        </div>
      </div>
    </AdminGlassPanel>
  );
}

function TimelinePanel({ timeline }: { timeline: TimelineItem[] }) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='border-b border-white/10 px-4 py-3 sm:px-5'>
        <h3 className='text-sm font-semibold text-white'>Timeline</h3>
        <p className='mt-1 text-xs text-slate-500'>Core server-side processing checkpoints.</p>
      </div>
      <div className='space-y-4 p-4 sm:p-5'>
        {timeline.map((item) => (
          <TimelineRow key={item.label} item={item} />
        ))}
      </div>
    </AdminGlassPanel>
  );
}

function NotificationsPanel({
  notifications,
  customerNotifications,
  orderToken,
}: {
  notifications: AdminNotificationHistoryItem[];
  customerNotifications: CustomerNotificationHistoryItem[];
  orderToken: string;
}) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='border-b border-white/10 px-4 py-3 sm:px-5'>
        <h3 className='text-sm font-semibold text-white'>Notifications</h3>
        <p className='mt-1 text-xs text-slate-500'>Internal recovery alerts for this paid order.</p>
      </div>
      <div className='p-4 sm:p-5'>
        <AdminNotificationHistoryPanel notifications={notifications} orderToken={orderToken} />
        <CustomerNotificationHistoryPanel
          notifications={customerNotifications}
          orderToken={orderToken}
        />
      </div>
    </AdminGlassPanel>
  );
}

function RecoveryActionsPanel({
  recovery,
  detail,
}: {
  recovery: PaidOrderRecoveryRow;
  detail: PaidOrderRecoveryDetail;
}) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='border-b border-white/10 px-4 py-3 sm:px-5'>
        <h3 className='text-sm font-semibold text-white'>Recovery Actions</h3>
        <p className='mt-1 text-xs text-slate-500'>Operator controls for this paid order.</p>
      </div>
      <div className='p-4 sm:p-5'>
        <AdminPaidOrderRecoveryActionsPanel
          orderToken={recovery.orderToken}
          isCompleted={recovery.status === 'completed'}
          needsProviderDetailSync={detail.needsProviderDetailSync}
          requiresPushOverride={detail.requiresPushOverride}
        />
        <button
          type='button'
          className='mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300/30 bg-rose-400/8 px-3 py-3 text-sm font-medium text-rose-200'
        >
          <ArrowDownLeft size={16} />
          Add Internal Note
        </button>
      </div>
    </AdminGlassPanel>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  return (
    <div className='grid grid-cols-[18px_minmax(0,1fr)_auto] gap-3 text-sm'>
      <span
        className={cn(
          'mt-1 grid h-3.5 w-3.5 place-items-center rounded-full',
          item.state === 'done' && 'bg-emerald-500',
          item.state === 'failed' && 'bg-rose-500',
          item.state === 'pending' && 'bg-slate-500',
        )}
      >
        {item.state === 'done' ? <CheckCircle2 size={10} /> : null}
      </span>
      <span className={cn(item.state === 'failed' ? 'text-rose-300' : 'text-slate-200')}>
        {item.label}
      </span>
      <span className='text-xs text-slate-500'>{item.time}</span>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className='text-[10px] uppercase tracking-[0.12em] text-slate-500'>{label}</p>
      <p className='mt-1 truncate text-sm font-medium text-slate-100'>{value}</p>
    </div>
  );
}
