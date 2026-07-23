'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { BellOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/primitives/alert-dialog';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import {
  resendAdminRecoveryNotificationAction,
  suppressAdminRecoveryNotificationAction,
} from '@/app/admin/(dashboard)/shop/paid-order-recovery/actions';
import type { AdminNotificationHistoryItem } from './adminShopDashboardTypes';
import {
  formatNotificationType,
  formatNotificationTiming,
  NotificationActionButton,
  NotificationStatusBadge,
} from './NotificationHistoryPrimitives';

type AdminNotificationHistoryPanelProps = {
  notifications: AdminNotificationHistoryItem[];
  orderToken: string;
};

export default function AdminNotificationHistoryPanel({
  notifications,
  orderToken,
}: AdminNotificationHistoryPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingActions, setPendingActions] = useState<Set<string>>(() => new Set());
  const [suppressionTarget, setSuppressionTarget] = useState<{
    id: string;
    recipient: string | null;
  } | null>(null);

  const setActionPending = (actionKey: string, pending: boolean) => {
    setPendingActions((current) => {
      const next = new Set(current);

      if (pending) {
        next.add(actionKey);
      } else {
        next.delete(actionKey);
      }

      return next;
    });
  };

  const handleResend = (notificationId: string) => {
    const actionKey = `resend:${notificationId}`;
    setActionPending(actionKey, true);

    startTransition(async () => {
      const toastId = loadingToast({
        header: 'Resending notification',
        message: 'Trying the admin alert again now.',
      });

      try {
        const result = await resendAdminRecoveryNotificationAction({
          notificationId,
          orderToken,
        });

        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({
            header: 'Resend failed',
            message: result.error,
          });
          return;
        }

        successToast({
          header: 'Notification resent',
          message: result.message,
        });
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Resend failed',
          message: error instanceof Error ? error.message : 'Notification resend failed.',
        });
      } finally {
        setActionPending(actionKey, false);
      }
    });
  };

  const handleSuppress = (notificationId: string) => {
    const actionKey = `suppress:${notificationId}`;
    setActionPending(actionKey, true);

    startTransition(async () => {
      const toastId = loadingToast({
        header: 'Suppressing notification',
        message: 'Updating this outbox entry.',
      });

      try {
        const result = await suppressAdminRecoveryNotificationAction({
          notificationId,
          orderToken,
        });

        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({
            header: 'Suppress failed',
            message: result.error,
          });
          return;
        }

        successToast({
          header: 'Notification suppressed',
          message: result.message,
        });
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Suppress failed',
          message: error instanceof Error ? error.message : 'Notification suppress failed.',
        });
      } finally {
        setActionPending(actionKey, false);
      }
    });
  };

  if (!notifications.length) {
    return (
      <p className='text-sm text-slate-400'>No admin notifications recorded for this order.</p>
    );
  }

  return (
    <>
      <div className='space-y-3'>
        {notifications.map((notification) => {
          const canResend = notification.status !== 'sent' && notification.status !== 'suppressed';
          const canSuppress = notification.status !== 'suppressed';
          const resendPending = pendingActions.has(`resend:${notification.id}`);
          const suppressPending = pendingActions.has(`suppress:${notification.id}`);
          const rowPending = resendPending || suppressPending;

          return (
            <div
              key={notification.id}
              className='rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm'
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='break-words font-medium text-slate-100'>
                    {notification.recipient ?? 'No recipient'}
                  </p>
                  <p className='mt-1 text-sm text-slate-300'>
                    {formatNotificationType(notification.type)}
                    {notification.errorCode ? ` · ${notification.errorCode}` : ''}
                  </p>
                  <p className='mt-1 text-xs leading-5 text-slate-400'>
                    {formatNotificationTiming(notification.createdAt, notification.sentAt)} ·{' '}
                    {notification.severity}
                  </p>
                </div>
                <NotificationStatusBadge status={notification.status} />
              </div>

              {notification.lastErrorMessage ? (
                <p className='mt-2 text-sm leading-5 text-rose-200'>
                  {notification.lastErrorMessage}
                </p>
              ) : null}

              <div className='mt-3 flex flex-wrap items-center gap-2'>
                {canResend ? (
                  <NotificationActionButton
                    icon={RefreshCw}
                    label='Resend'
                    disabled={rowPending}
                    pending={resendPending}
                    pendingLabel='Resending…'
                    onClick={() => handleResend(notification.id)}
                  />
                ) : null}

                {canSuppress ? (
                  <NotificationActionButton
                    icon={BellOff}
                    label='Suppress'
                    disabled={rowPending}
                    pending={suppressPending}
                    pendingLabel='Suppressing…'
                    tone='secondary'
                    onClick={() =>
                      setSuppressionTarget({
                        id: notification.id,
                        recipient: notification.recipient,
                      })
                    }
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={Boolean(suppressionTarget)}
        onOpenChange={(open) => {
          if (!open) setSuppressionTarget(null);
        }}
      >
        <AlertDialogContent className='w-[min(94vw,520px)] rounded-xl border border-amber-300/20 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'>
          <AlertDialogHeader>
            <AlertDialogTitle className='text-white'>Suppress this notification?</AlertDialogTitle>
            <AlertDialogDescription className='text-sm leading-6 text-slate-300'>
              This prevents further delivery attempts for
              {suppressionTarget?.recipient
                ? ` ${suppressionTarget.recipient}`
                : ' this notification'}
              . The outbox record remains available in the audit history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white'>
              Keep notification
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!suppressionTarget) return;
                handleSuppress(suppressionTarget.id);
                setSuppressionTarget(null);
              }}
              className='border border-amber-300/35 bg-amber-300 text-slate-950 hover:bg-amber-200'
            >
              Suppress notification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
