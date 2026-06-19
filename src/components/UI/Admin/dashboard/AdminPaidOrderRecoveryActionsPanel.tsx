'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { CheckCircle2, ClipboardList, DatabaseZap, RefreshCw, SearchCheck } from 'lucide-react';
import { toast } from 'sonner';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import { cn } from '@/lib/utils';
import { retryAdminPaidOrderRecoveryAction } from '@/app/admin/shop/paid-order-recovery/actions';
import type { AdminIcon } from './adminShopDashboardTypes';

type AdminRecoveryActionsPanelProps = {
  orderToken: string;
  isCompleted: boolean;
  needsProviderDetailSync: boolean;
};

export default function AdminPaidOrderRecoveryActionsPanel({
  orderToken,
  isCompleted,
  needsProviderDetailSync,
}: AdminRecoveryActionsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
      {needsProviderDetailSync ? (
        <ActionButton icon={SearchCheck} tone='cyan' disabled>
          Sync Provider Details
        </ActionButton>
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
          Fulfillment was already accepted. Do not retry the full pipeline; reconcile the provider
          order through Merchize detail sync.
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
  tone?: 'cyan';
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
          : 'border-white/10 bg-white/[0.04] text-slate-200',
      )}
    >
      <Icon size={16} />
      {children}
    </button>
  );
}
