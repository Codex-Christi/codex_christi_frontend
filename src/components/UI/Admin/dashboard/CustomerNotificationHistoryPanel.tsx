'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import { resendCustomerNotificationAction } from '@/app/admin/(dashboard)/shop/paid-order-recovery/actions';
import type { CustomerNotificationHistoryItem } from './adminShopDashboardTypes';
import {
  formatNotificationType,
  formatNotificationTiming,
  NotificationActionButton,
  NotificationStatusBadge,
} from './NotificationHistoryPrimitives';

type CustomerNotificationHistoryPanelProps = {
  notifications: CustomerNotificationHistoryItem[];
  orderToken: string;
};

export default function CustomerNotificationHistoryPanel({
  notifications,
  orderToken,
}: CustomerNotificationHistoryPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingNotificationIds, setPendingNotificationIds] = useState<Set<string>>(
    () => new Set(),
  );

  const handleResend = (notificationId: string) => {
    setPendingNotificationIds((current) => new Set(current).add(notificationId));

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
      } finally {
        setPendingNotificationIds((current) => {
          const next = new Set(current);
          next.delete(notificationId);
          return next;
        });
      }
    });
  };

  return (
    <div className='mt-4 border-t border-white/10 pt-4'>
      <h4 className='text-sm font-semibold text-slate-200'>Customer notifications</h4>
      {!notifications.length ? (
        <p className='mt-3 text-sm text-slate-400'>No customer notifications recorded.</p>
      ) : (
        <div className='mt-3 space-y-3'>
          {notifications.map((notification) => {
            const canResend =
              notification.status !== 'sent' && notification.status !== 'suppressed';
            const resendPending = pendingNotificationIds.has(notification.id);

            return (
              <div
                key={notification.id}
                className='rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='break-words font-medium text-slate-100'>
                      {notification.recipient}
                    </p>
                    <p className='mt-1 text-sm text-slate-300'>
                      {formatNotificationType(notification.type)}
                    </p>
                    <p className='mt-1 text-xs leading-5 text-slate-400'>
                      {formatNotificationTiming(notification.createdAt, notification.sentAt)}
                    </p>
                  </div>
                  <NotificationStatusBadge status={notification.status} />
                </div>
                {notification.lastErrorMessage ? (
                  <p className='mt-2 text-sm leading-5 text-rose-200'>
                    {notification.lastErrorMessage}
                  </p>
                ) : null}

                {canResend ? (
                  <div className='mt-3 flex items-center gap-2'>
                    <NotificationActionButton
                      icon={RefreshCw}
                      label='Resend'
                      pending={resendPending}
                      pendingLabel='Resending…'
                      onClick={() => handleResend(notification.id)}
                    />
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
