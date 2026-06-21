'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  KeyRound,
  RefreshCw,
  SearchCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import { cn } from '@/lib/utils';
import {
  overrideMerchizePushDisabledAndReleaseAction,
  retryAdminPaidOrderRecoveryAction,
  syncAdminMerchizeProviderDetailsAction,
} from '@/app/admin/shop/paid-order-recovery/actions';
import type { AdminIcon } from './adminShopDashboardTypes';

type AdminRecoveryActionsPanelProps = {
  orderToken: string;
  isCompleted: boolean;
  needsProviderDetailSync: boolean;
  requiresPushOverride: boolean;
};

export default function AdminPaidOrderRecoveryActionsPanel({
  orderToken,
  isCompleted,
  needsProviderDetailSync,
  requiresPushOverride,
}: AdminRecoveryActionsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [overridePassword, setOverridePassword] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const handleProviderDetailSync = () => {
    startTransition(async () => {
      const toastId = loadingToast({
        header: 'Syncing provider details',
        message: 'Looking up the accepted Merchize order and refreshing detail snapshots.',
      });

      try {
        const result = await syncAdminMerchizeProviderDetailsAction({ orderToken });
        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({
            header: 'Sync did not complete',
            message: result.error,
          });
          router.refresh();
          return;
        }

        successToast({
          header: 'Provider details synced',
          message: result.message,
        });
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Sync failed',
          message: error instanceof Error ? error.message : 'Provider detail sync failed.',
        });
      }
    });
  };

  const handleRetry = () => {
    startTransition(async () => {
      const toastId = loadingToast({
        header: 'Retrying order recovery',
        message: 'Running the server recovery pipeline again.',
      });

      try {
        const result = await retryAdminPaidOrderRecoveryAction({ orderToken });
        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({
            header: 'Retry did not complete',
            message: result.error,
          });
          router.refresh();
          return;
        }

        successToast({
          header: 'Recovery completed',
          message: result.message,
        });
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Retry failed',
          message: error instanceof Error ? error.message : 'Retry failed.',
        });
      }
    });
  };

  const handlePushOverride = () => {
    if (!overridePassword.trim() || !overrideReason.trim()) {
      errorToast({
        header: 'Override needs details',
        message: 'Enter the master admin password and a release reason.',
      });
      return;
    }

    const confirmed = window.confirm(
      'This will override the disabled Merchize push gate and release this paid order to fulfillment. Continue?',
    );

    if (!confirmed) return;

    startTransition(async () => {
      const toastId = loadingToast({
        header: 'Releasing fulfillment push',
        message: 'Running the master-admin push override for this order.',
      });

      try {
        const result = await overrideMerchizePushDisabledAndReleaseAction({
          orderToken,
          password: overridePassword,
          reason: overrideReason,
        });
        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({
            header: 'Push override did not complete',
            message: result.error,
          });
          router.refresh();
          return;
        }

        setOverridePassword('');
        setOverrideReason('');
        successToast({
          header: 'Order released',
          message: result.message,
        });
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Push override failed',
          message: error instanceof Error ? error.message : 'Push override failed.',
        });
      }
    });
  };

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
      {requiresPushOverride ? (
        <div className='sm:col-span-2 xl:col-span-1 2xl:col-span-2 rounded-lg border border-amber-300/18 bg-amber-300/[0.06] p-3'>
          <div className='flex items-start gap-2'>
            <KeyRound size={16} className='mt-0.5 shrink-0 text-amber-100' />
            <div>
              <p className='text-sm font-medium text-amber-50'>Push disabled by configuration</p>
              <p className='mt-1 text-xs leading-5 text-amber-50/70'>
                Master admin release is required before this order can be pushed to Merchize
                fulfillment.
              </p>
            </div>
          </div>

          <div className='mt-3 grid gap-2'>
            <input
              type='password'
              value={overridePassword}
              onChange={(event) => setOverridePassword(event.target.value)}
              placeholder='Master admin password'
              autoComplete='current-password'
              className='h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-200/40'
            />
            <textarea
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder='Release reason'
              rows={3}
              className='resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-200/40'
            />
            <ActionButton
              icon={KeyRound}
              tone='amber'
              disabled={isPending || isCompleted}
              onClick={handlePushOverride}
            >
              {isPending ? 'Releasing...' : 'Override and Push'}
            </ActionButton>
          </div>
        </div>
      ) : null}

      {needsProviderDetailSync ? (
        <>
          <ActionButton
            icon={SearchCheck}
            tone='cyan'
            disabled={isPending}
            onClick={handleProviderDetailSync}
          >
            {isPending ? 'Syncing...' : 'Sync Provider Details'}
          </ActionButton>
          <ActionButton
            icon={RefreshCw}
            tone='cyan'
            disabled={isPending || isCompleted}
            onClick={handleRetry}
          >
            {isCompleted ? 'Already Completed' : isPending ? 'Pushing...' : 'Push To Fulfillment'}
          </ActionButton>
        </>
      ) : (
        <ActionButton
          icon={RefreshCw}
          tone='cyan'
          disabled={isPending || isCompleted}
          onClick={handleRetry}
        >
          {isCompleted ? 'Already Completed' : isPending ? 'Retrying...' : 'Retry Fulfillment'}
        </ActionButton>
      )}

      <ActionButton icon={DatabaseZap} disabled>
        View in Ledger
      </ActionButton>

      <ActionButton icon={ClipboardList} disabled>
        Regenerate Receipt
      </ActionButton>

      <ActionButton icon={CheckCircle2} disabled>
        Mark Resolved
      </ActionButton>

      {needsProviderDetailSync ? (
        <p className='sm:col-span-2 xl:col-span-1 2xl:col-span-2 rounded-lg border border-cyan-300/14 bg-cyan-300/[0.05] px-3 py-2 text-xs leading-5 text-cyan-50/80'>
          Django accepted the fulfillment process. Provider sync and push continue from that
          accepted state without replaying payment capture, receipt upload, or Django payment save.
        </p>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  tone,
  children,
  disabled,
  onClick,
}: {
  icon: AdminIcon;
  tone?: 'cyan' | 'amber';
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type='button'
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45',
        tone === 'cyan'
          ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100 hover:border-cyan-200/50 hover:bg-cyan-300/14'
          : tone === 'amber'
            ? 'border-amber-300/35 bg-amber-300/10 text-amber-100 hover:border-amber-200/50 hover:bg-amber-300/14'
          : 'border-white/10 bg-white/[0.04] text-slate-200',
      )}
    >
      <Icon size={16} />
      {children}
    </button>
  );
}
