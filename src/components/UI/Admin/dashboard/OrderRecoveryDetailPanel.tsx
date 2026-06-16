import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import AdminGlassPanel from './AdminGlassPanel';
import { adminRecoveryActions } from './adminShopDashboardData';
import type {
  AdminIcon,
  AdminNotificationHistoryItem,
  OrderRecoveryRow,
  TimelineItem,
} from './adminShopDashboardTypes';

type OrderRecoveryDetailPanelProps = {
  recovery: OrderRecoveryRow;
  timeline?: TimelineItem[];
  notifications?: AdminNotificationHistoryItem[];
  onClose?: () => void;
  variant?: 'panel' | 'page';
};

export default function OrderRecoveryDetailPanel({
  recovery,
  timeline = [],
  notifications = [],
  onClose,
  variant = 'panel',
}: OrderRecoveryDetailPanelProps) {
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
          {variant === 'page' ? 'Order Recovery Detail' : 'Order Recovery'}
        </div>
        {onClose ? (
          <div className='flex items-center gap-4'>
            <ArrowLeft size={16} />
            <ArrowRight size={16} />
            <button
              type='button'
              aria-label='Close order recovery detail'
              onClick={onClose}
              className='rounded-md text-slate-400 transition hover:text-white'
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 space-y-5 p-4 sm:space-y-6 sm:p-5',
          variant === 'panel' ? 'overflow-y-auto xl:overflow-visible' : 'overflow-visible',
        )}
      >
        <section>
          <div className='flex items-center justify-between gap-3'>
            <h2 className='text-lg font-semibold text-white sm:text-xl'>{recovery.supportRef}</h2>
            <span className='rounded-md border border-rose-300/20 bg-rose-400/12 px-2.5 py-1 text-xs font-medium text-rose-200'>
              {recovery.status}
            </span>
          </div>
          <p className='mt-2 text-sm text-slate-400'>Support ref · {recovery.supportRef}</p>
          <p className='mt-4 text-sm text-slate-200'>{recovery.customer}</p>
          <p className='mt-3 text-sm text-slate-200'>
            {recovery.amount} <span className='mx-2 text-slate-600'>•</span>
            <span className='text-blue-300'>PayPal</span>
          </p>
        </section>

        <Divider />

        <section>
          <h3 className='text-sm font-semibold text-white'>Current Step</h3>
          <div className='mt-3 text-sm text-slate-300'>
            <p className='font-medium'>{recovery.step}</p>
            <p className='mt-1 text-slate-400'>Current ledger checkpoint for this paid order.</p>
          </div>
        </section>

        <section>
          <h3 className='text-sm font-semibold text-white'>Last Error</h3>
          <div className='mt-3 flex items-start gap-2 text-sm'>
            <span className='mt-1.5 h-2 w-2 rounded-full bg-rose-400' />
            <div>
              <p className='font-medium text-slate-200'>{recovery.error}</p>
              <p className='mt-1 text-slate-400'>Raw provider and ledger details remain available to admin here.</p>
            </div>
          </div>
        </section>

        <Divider />

        <section>
          <h3 className='text-sm font-semibold text-white'>Timeline</h3>
          <div className='mt-4 space-y-4'>
            {timeline.map((item) => (
              <TimelineRow key={item.label} item={item} />
            ))}
          </div>
        </section>

        <Divider />

        <section>
          <h3 className='text-sm font-semibold text-white'>Notifications</h3>
          <div className='mt-4 space-y-3'>
            {notifications.length ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className='rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm'
                >
                  <div className='flex items-center justify-between gap-3'>
                    <p className='font-medium text-slate-200'>{notification.recipient ?? 'No recipient'}</p>
                    <span className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-slate-400'>
                      {notification.status}
                    </span>
                  </div>
                  <p className='mt-1 text-xs text-slate-500'>{notification.createdAt}</p>
                  {notification.lastErrorMessage ? (
                    <p className='mt-2 text-xs text-rose-300'>{notification.lastErrorMessage}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className='text-sm text-slate-500'>No admin notifications recorded for this order.</p>
            )}
          </div>
        </section>

        <Divider />

        <section>
          <h3 className='text-sm font-semibold text-white'>Actions</h3>
          <div className='mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
            {adminRecoveryActions.map((action) => (
              <ActionButton key={action.label} icon={action.icon} tone={action.tone}>
                {action.label}
              </ActionButton>
            ))}
          </div>
          <button
            type='button'
            className='mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-rose-300/30 bg-rose-400/8 px-3 py-3 text-sm font-medium text-rose-200'
          >
            <ArrowDownLeft size={16} />
            Add Internal Note
          </button>
        </section>
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

function ActionButton({
  icon: Icon,
  tone,
  children,
}: {
  icon: AdminIcon;
  tone?: 'cyan';
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium',
        tone === 'cyan'
          ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100'
          : 'border-white/10 bg-white/[0.04] text-slate-200',
      )}
    >
      <Icon size={16} />
      {children}
    </button>
  );
}

function Divider() {
  return <div className='h-px bg-white/10' />;
}
