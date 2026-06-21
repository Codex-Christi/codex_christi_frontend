'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import { cn } from '@/lib/utils';
import { resendCustomerNotificationAction } from '@/app/admin/(dashboard)/shop/paid-order-recovery/actions';
import type { CustomerNotificationHistoryItem } from './adminShopDashboardTypes';

type CustomerNotificationHistoryPanelProps = {
  notifications: CustomerNotificationHistoryItem[];
  orderToken: string;
};

export default function CustomerNotificationHistoryPanel({
  notifications,
  orderToken,
}: CustomerNotificationHistoryPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleResend = (notificationId: string) => {
    startTransition(async () => {
      const toastId = loadingToast({
        header: 'Resending customer email',
        message: 'Trying the customer notification again now.',
      });

      try {
        const result = await resendCustomerNotificationAction({
          notificationId,
          orderToken,
        });

        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({
            header: 'Customer resend failed',
            message: result.error,
          });
          return;
        }

        successToast({
          header: 'Customer email resent',
          message: result.message,
        });
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Customer resend failed',
          message: error instanceof Error ? error.message : 'Customer notification resend failed.',
        });
      }
    });
  };

  return (
    <div className='mt-4 border-t border-white/10 pt-4'>
      <h4 className='text-xs font-semibold uppercase tracking-[0.12em] text-slate-500'>
        Customer Notifications
      </h4>
      {!notifications.length ? (
        <p className='mt-3 text-sm text-slate-500'>No customer notifications recorded.</p>
      ) : (
        <div className='mt-3 space-y-3'>
          {notifications.map((notification) => {
            const canResend =
              notification.status !== 'sent' && notification.status !== 'suppressed';

            return (
              <div
                key={notification.id}
                className='rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='truncate font-medium text-slate-200'>{notification.recipient}</p>
                    <p className='mt-1 text-xs text-slate-500'>
                      {notification.type.replaceAll('_', ' ')}
                    </p>
                    <p className='mt-1 text-xs text-slate-600'>{notification.createdAt}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em]',
                      notification.status === 'sent' &&
                        'border-emerald-300/15 bg-emerald-300/8 text-emerald-200',
                      notification.status === 'failed' &&
                        'border-rose-300/15 bg-rose-300/8 text-rose-200',
                      notification.status === 'pending' &&
                        'border-amber-300/15 bg-amber-300/8 text-amber-200',
                      notification.status === 'suppressed' &&
                        'border-slate-300/15 bg-slate-300/8 text-slate-300',
                    )}
                  >
                    {notification.status}
                  </span>
                </div>
                {notification.lastErrorMessage ? (
                  <p className='mt-2 text-xs leading-5 text-rose-300'>
                    {notification.lastErrorMessage}
                  </p>
                ) : null}

                {canResend ? (
                  <div className='mt-3 flex items-center gap-2'>
                    <button
                      type='button'
                      disabled={isPending}
                      onClick={() => handleResend(notification.id)}
                      className='inline-flex items-center gap-1.5 rounded-md border border-cyan-300/20 bg-cyan-300/8 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-200/35 hover:bg-cyan-300/12 disabled:cursor-not-allowed disabled:opacity-50'
                    >
                      <RefreshCw size={13} />
                      Resend
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
