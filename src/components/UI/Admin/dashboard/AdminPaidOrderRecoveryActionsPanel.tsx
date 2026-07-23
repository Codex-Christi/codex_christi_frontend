'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition, type ReactNode } from 'react';
import {
  ClipboardList,
  KeyRound,
  Loader2,
  MapPinCheck,
  RefreshCw,
  SearchCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import errorToast from '@/lib/error-toast';
import loadingToast from '@/lib/loading-toast';
import successToast from '@/lib/success-toast';
import { cn } from '@/lib/utils';
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
import {
  markPaidOrderFulfillmentAddressValidAction,
  regeneratePaidOrderReceiptAction,
  releaseMerchizeFulfillmentToProductionAction,
  retryAdminPaidOrderRecoveryAction,
  syncAdminMerchizeProviderDetailsAction,
} from '@/app/admin/(dashboard)/shop/paid-order-recovery/actions';
import type { AdminIcon } from './adminShopDashboardTypes';

type AdminRecoveryActionsPanelProps = {
  orderToken: string;
  isCompleted: boolean;
  needsProviderDetailSync: boolean;
  requiresManualRelease: boolean;
  canConfirmProviderAddress: boolean;
  recoveryStatus: 'failed' | 'recovery' | 'pending' | 'completed' | 'sync' | 'attention';
  manualReleaseReadinessWarning?: string | null;
};

type PendingAction =
  | 'refresh-merchize'
  | 'retry-recovery'
  | 'release-production'
  | 'confirm-address'
  | 'regenerate-receipt';

export default function AdminPaidOrderRecoveryActionsPanel({
  orderToken,
  isCompleted,
  needsProviderDetailSync,
  requiresManualRelease,
  canConfirmProviderAddress,
  recoveryStatus,
  manualReleaseReadinessWarning = null,
}: AdminRecoveryActionsPanelProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const pendingActionRef = useRef<PendingAction | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [overridePassword, setOverridePassword] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [releaseFormOpen, setReleaseFormOpen] = useState(false);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [addressConfirmOpen, setAddressConfirmOpen] = useState(false);
  const [addressConfirmPassword, setAddressConfirmPassword] = useState('');
  const [addressConfirmReason, setAddressConfirmReason] = useState('');
  const resumesFullPostPaymentFlow = recoveryStatus === 'recovery';
  const isAnyActionPending = pendingAction !== null;
  const releaseDisabledReason = isCompleted
    ? 'Post-payment processing is already complete.'
    : undefined;
  const retryActionLabel = needsProviderDetailSync
    ? 'Continue Merchize fulfillment'
    : resumesFullPostPaymentFlow
      ? 'Resume post-payment processing'
      : 'Retry Merchize fulfillment';
  const retryPendingLabel = needsProviderDetailSync
    ? 'Continuing Merchize fulfillment...'
    : resumesFullPostPaymentFlow
      ? 'Resuming post-payment processing...'
      : 'Retrying Merchize fulfillment...';

  const runAction = (action: PendingAction, task: () => Promise<void>) => {
    if (pendingActionRef.current) return;

    pendingActionRef.current = action;
    setPendingAction(action);
    startTransition(async () => {
      try {
        await task();
      } finally {
        pendingActionRef.current = null;
        setPendingAction(null);
      }
    });
  };

  const handleProviderDetailSync = () => {
    runAction('refresh-merchize', async () => {
      const toastId = loadingToast({
        header: 'Refreshing Merchize state',
        message: 'Looking up the accepted Merchize order and refreshing detail snapshots.',
      });

      try {
        const result = await syncAdminMerchizeProviderDetailsAction({ orderToken });
        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({
            header: 'Merchize refresh did not complete',
            message: result.error,
          });
          router.refresh();
          return;
        }

        if (result.tone === 'warning') {
          toast.warning('Merchize refresh pending', {
            description: result.message,
          });
        } else {
          successToast({
            header: 'Merchize state refreshed',
            message: result.message,
          });
        }
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Merchize refresh failed',
          message: error instanceof Error ? error.message : 'Merchize state refresh failed.',
        });
      }
    });
  };

  const handleRetry = () => {
    runAction('retry-recovery', async () => {
      const toastId = loadingToast({
        header: resumesFullPostPaymentFlow
          ? 'Resuming post-payment processing'
          : 'Retrying fulfillment recovery',
        message: resumesFullPostPaymentFlow
          ? 'Continuing receipt, Django payment save, and fulfillment handoff from the paid ledger row.'
          : 'Running the server recovery pipeline again.',
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

  const handleReviewRelease = () => {
    if (releaseDisabledReason) {
      errorToast({
        header: 'Manual release unavailable',
        message: releaseDisabledReason,
      });
      return;
    }

    if (!overridePassword.trim() || !overrideReason.trim()) {
      errorToast({
        header: 'Override needs details',
        message: 'Enter the master admin password and a release reason.',
      });
      return;
    }

    setReleaseConfirmOpen(true);
  };

  const handlePushOverride = () => {
    if (releaseDisabledReason) {
      setReleaseConfirmOpen(false);
      errorToast({
        header: 'Manual release unavailable',
        message: releaseDisabledReason,
      });
      return;
    }

    if (!overridePassword.trim() || !overrideReason.trim()) {
      setReleaseConfirmOpen(false);
      errorToast({
        header: 'Override needs details',
        message: 'Enter the master admin password and a release reason.',
      });
      return;
    }

    setReleaseConfirmOpen(false);
    runAction('release-production', async () => {
      const toastId = loadingToast({
        header: 'Releasing to production',
        message: 'Verifying readiness and running the master-admin production release.',
      });

      try {
        const result = await releaseMerchizeFulfillmentToProductionAction({
          orderToken,
          password: overridePassword,
          reason: overrideReason,
        });
        toast.dismiss(toastId);

        if (!result.ok) {
          errorToast({
            header: 'Production release did not complete',
            message: result.error,
          });
          router.refresh();
          return;
        }

        setOverridePassword('');
        setOverrideReason('');
        setReleaseFormOpen(false);
        successToast({
          header: 'Order released',
          message: result.message,
        });
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Production release failed',
          message: error instanceof Error ? error.message : 'Production release failed.',
        });
      }
    });
  };

  const handleReceiptRegeneration = () => {
    runAction('regenerate-receipt', async () => {
      const toastId = loadingToast({
        header: 'Regenerating receipt',
        message: 'Rebuilding the receipt from the durable ledger and active address correction.',
      });
      try {
        const result = await regeneratePaidOrderReceiptAction({ orderToken });
        toast.dismiss(toastId);
        if (!result.ok) {
          errorToast({ header: 'Receipt not regenerated', message: result.error });
          return;
        }
        successToast({ header: 'Receipt regenerated', message: result.message });
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        errorToast({
          header: 'Receipt not regenerated',
          message: error instanceof Error ? error.message : 'Receipt regeneration failed.',
        });
      }
    });
  };

  const handleAddressConfirmation = () => {
    if (!addressConfirmPassword.trim() || !addressConfirmReason.trim()) {
      errorToast({
        header: 'Confirmation needs details',
        message: 'Enter the master admin password and how the current address was confirmed.',
      });
      return;
    }

    setAddressConfirmOpen(false);
    runAction('confirm-address', async () => {
      const toastId = loadingToast({
        header: 'Confirming current address',
        message: 'Requesting Merchize confirmation and verifying the resulting readiness state.',
      });

      try {
        const result = await markPaidOrderFulfillmentAddressValidAction({
          orderToken,
          password: addressConfirmPassword,
          reason: addressConfirmReason,
        });
        toast.dismiss(toastId);

        if (!result.ok) {
          setAddressConfirmPassword('');
          errorToast({
            header: 'Address was not confirmed',
            message: result.error,
          });
          router.refresh();
          return;
        }

        setAddressConfirmPassword('');
        setAddressConfirmReason('');
        if (result.tone === 'warning') {
          toast.warning('Address confirmation recorded', {
            description: result.message,
          });
        } else {
          successToast({
            header: 'Address confirmed',
            message: result.message,
          });
        }
        router.refresh();
      } catch (error) {
        toast.dismiss(toastId);
        setAddressConfirmPassword('');
        errorToast({
          header: 'Address was not confirmed',
          message: error instanceof Error ? error.message : 'Address confirmation failed.',
        });
      }
    });
  };

  const handleAddressConfirmOpenChange = (nextOpen: boolean) => {
    setAddressConfirmOpen(nextOpen);
    if (!nextOpen && pendingAction !== 'confirm-address') {
      setAddressConfirmPassword('');
      setAddressConfirmReason('');
    }
  };

  const handleCancelRelease = () => {
    if (pendingAction === 'release-production') return;

    setReleaseConfirmOpen(false);
    setReleaseFormOpen(false);
    setOverridePassword('');
    setOverrideReason('');
  };

  return (
    <>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
        {pendingAction ? (
          <p
            role='status'
            aria-live='polite'
            className='sm:col-span-2 xl:col-span-1 2xl:col-span-2 inline-flex items-center gap-2 rounded-lg border border-cyan-300/14 bg-cyan-300/[0.05] px-3 py-2 text-xs leading-5 text-cyan-50/80'
          >
            <Loader2 size={14} className='shrink-0 animate-spin' />
            {getPendingActionStatus(pendingAction)}
          </p>
        ) : null}

        {requiresManualRelease ? (
          <div className='sm:col-span-2 xl:col-span-1 2xl:col-span-2 rounded-lg border border-amber-300/18 bg-amber-300/[0.06] p-3'>
            <div className='flex items-start gap-2'>
              <KeyRound size={16} className='mt-0.5 shrink-0 text-amber-100' />
              <div>
                <p className='text-sm font-medium text-amber-50'>
                  Manual Merchize production release required
                </p>
                <p className='mt-1 text-xs leading-5 text-amber-50/80'>
                  A master admin can bypass only the configuration or seven-day release gate.
                  Address, catalog, artwork, cost, and provider-attention blockers are never
                  bypassed.
                </p>
              </div>
            </div>

            {manualReleaseReadinessWarning ? (
              <p className='mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs leading-5 text-amber-50'>
                {manualReleaseReadinessWarning}
              </p>
            ) : null}

            {!releaseFormOpen ? (
              <div className='mt-3'>
                <ActionButton
                  icon={KeyRound}
                  tone='amber'
                  disabled={isAnyActionPending || isCompleted}
                  disabledReason={releaseDisabledReason}
                  onClick={() => setReleaseFormOpen(true)}
                >
                  Review manual release
                </ActionButton>
              </div>
            ) : (
              <form
                className='mt-3 grid gap-3 rounded-lg border border-amber-300/14 bg-black/15 p-3'
                onSubmit={(event) => {
                  event.preventDefault();
                  handleReviewRelease();
                }}
              >
                <label className='grid gap-1.5 text-xs font-medium text-amber-50/90'>
                  Master admin password
                  <input
                    type='password'
                    value={overridePassword}
                    onChange={(event) => setOverridePassword(event.target.value)}
                    autoComplete='current-password'
                    required
                    className='h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm font-normal text-white outline-none transition focus:border-amber-200/40'
                  />
                </label>
                <label className='grid gap-1.5 text-xs font-medium text-amber-50/90'>
                  Release reason
                  <textarea
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    placeholder='Example: Reviewed age hold and confirmed production release.'
                    rows={3}
                    required
                    className='resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-normal text-white outline-none transition placeholder:text-slate-500 focus:border-amber-200/40'
                  />
                </label>
                <p className='text-xs leading-5 text-amber-50/65'>
                  Credentials are submitted only after you review and confirm the release scope.
                </p>
                <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                  <button
                    type='button'
                    disabled={pendingAction === 'release-production'}
                    onClick={handleCancelRelease}
                    className='inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
                  >
                    Cancel
                  </button>
                  <button
                    type='submit'
                    disabled={isAnyActionPending || isCompleted}
                    className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300/35 bg-amber-300/10 px-3 text-sm font-medium text-amber-100 transition hover:border-amber-200/50 hover:bg-amber-300/14 disabled:cursor-not-allowed disabled:opacity-45'
                  >
                    <KeyRound size={16} />
                    Review production release
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}

        <ActionButton
          icon={SearchCheck}
          tone='cyan'
          busy={pendingAction === 'refresh-merchize'}
          disabled={isAnyActionPending}
          onClick={handleProviderDetailSync}
        >
          {pendingAction === 'refresh-merchize'
            ? 'Refreshing Merchize state...'
            : 'Refresh Merchize state'}
        </ActionButton>

        <ActionButton
          icon={RefreshCw}
          tone='cyan'
          busy={pendingAction === 'retry-recovery'}
          disabled={isAnyActionPending || isCompleted}
          disabledReason={
            isCompleted ? 'Post-payment processing is already complete; no retry is needed.' : null
          }
          onClick={handleRetry}
        >
          {isCompleted
            ? 'Post-payment processing complete'
            : pendingAction === 'retry-recovery'
              ? retryPendingLabel
              : retryActionLabel}
        </ActionButton>

        {canConfirmProviderAddress ? (
          <ActionButton
            icon={MapPinCheck}
            tone='amber'
            busy={pendingAction === 'confirm-address'}
            disabled={isAnyActionPending || isCompleted}
            disabledReason={
              isCompleted ? 'The provider order is already verified as released.' : null
            }
            onClick={() => setAddressConfirmOpen(true)}
          >
            {pendingAction === 'confirm-address'
              ? 'Confirming current address...'
              : 'Mark current address as valid'}
          </ActionButton>
        ) : null}

        <ActionButton
          icon={ClipboardList}
          busy={pendingAction === 'regenerate-receipt'}
          disabled={isAnyActionPending}
          onClick={handleReceiptRegeneration}
        >
          {pendingAction === 'regenerate-receipt'
            ? 'Regenerating receipt...'
            : 'Regenerate receipt'}
        </ActionButton>

        {needsProviderDetailSync ? (
          <p className='sm:col-span-2 xl:col-span-1 2xl:col-span-2 rounded-lg border border-cyan-300/14 bg-cyan-300/[0.05] px-3 py-2 text-xs leading-5 text-cyan-50/80'>
            Django accepted the fulfillment process. Refreshing Merchize state or continuing
            fulfillment starts from that accepted state without replaying payment capture, receipt
            upload, or Django payment save.
          </p>
        ) : null}
      </div>

      {requiresManualRelease ? (
        <AlertDialog open={releaseConfirmOpen} onOpenChange={setReleaseConfirmOpen}>
          <AlertDialogContent className='w-[min(94vw,560px)] rounded-xl border border-amber-300/20 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'>
            <AlertDialogHeader>
              <AlertDialogTitle className='text-white'>
                Release this order to Merchize production?
              </AlertDialogTitle>
              <AlertDialogDescription className='text-slate-400'>
                This reruns readiness checks, bypasses only the configuration or order-age gate, and
                then requests production release for order {orderToken.slice(0, 8).toUpperCase()}.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className='grid gap-3 text-xs leading-5'>
              <div className='rounded-lg border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-amber-50/80'>
                <span className='font-semibold text-amber-100'>Can bypass:</span> configuration or
                seven-day release gate.
              </div>
              <div className='rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-300'>
                <span className='font-semibold text-white'>Cannot bypass:</span> address, catalog,
                artwork, cost, or provider-attention blockers.
              </div>
              <div className='rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-slate-400'>
                <span className='font-semibold text-slate-200'>Recorded reason:</span>{' '}
                <span className='break-words'>{overrideReason.trim()}</span>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel className='border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white'>
                Go back
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isAnyActionPending || isCompleted}
                onClick={handlePushOverride}
                className='inline-flex items-center gap-2 border border-amber-300/35 bg-amber-300 text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50'
              >
                <KeyRound size={16} />
                Confirm production release
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

      {canConfirmProviderAddress ? (
        <AlertDialog open={addressConfirmOpen} onOpenChange={handleAddressConfirmOpenChange}>
          <AlertDialogContent className='w-[min(94vw,560px)] rounded-xl border border-amber-300/20 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'>
            <AlertDialogHeader>
              <AlertDialogTitle className='text-white'>
                Mark the current Merchize address as valid?
              </AlertDialogTitle>
              <AlertDialogDescription className='text-slate-300'>
                Use this only after the buyer or an authoritative source confirmed the corrected
                address. The server will verify that Merchize still stores the effective ledger
                address before marking it valid.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className='grid gap-3'>
              <label className='grid gap-1.5 text-xs font-medium text-amber-50/90'>
                Master admin password
                <input
                  type='password'
                  value={addressConfirmPassword}
                  onChange={(event) => setAddressConfirmPassword(event.target.value)}
                  autoComplete='current-password'
                  className='h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm font-normal text-white outline-none transition focus:border-amber-200/40'
                />
              </label>
              <label className='grid gap-1.5 text-xs font-medium text-amber-50/90'>
                Confirmation reason
                <textarea
                  value={addressConfirmReason}
                  onChange={(event) => setAddressConfirmReason(event.target.value)}
                  placeholder='Example: Buyer confirmed the current address by email.'
                  rows={3}
                  className='resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm font-normal text-white outline-none transition placeholder:text-slate-500 focus:border-amber-200/40'
                />
              </label>
              <p className='rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-300'>
                You do not need to enter the address again. This confirms the provider copy already
                saved by the correction flow and reruns readiness checks. It does not push the
                order.
              </p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel className='border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white'>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isAnyActionPending || isCompleted}
                onClick={(event) => {
                  if (!addressConfirmPassword.trim() || !addressConfirmReason.trim()) {
                    event.preventDefault();
                    handleAddressConfirmation();
                    return;
                  }
                  handleAddressConfirmation();
                }}
                className='inline-flex items-center gap-2 border border-amber-300/35 bg-amber-300 text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50'
              >
                <MapPinCheck size={16} />
                Confirm current address
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}

function ActionButton({
  icon: Icon,
  tone,
  children,
  disabled,
  disabledReason,
  busy = false,
  onClick,
}: {
  icon: AdminIcon;
  tone?: 'cyan' | 'amber';
  children: ReactNode;
  disabled?: boolean;
  disabledReason?: string | null;
  busy?: boolean;
  onClick?: () => void;
}) {
  const disabledReasonId = useId();
  const showDisabledReason = Boolean(disabled && disabledReason && !busy);

  return (
    <div className='min-w-0'>
      <button
        type='button'
        disabled={disabled || busy}
        aria-busy={busy}
        aria-describedby={showDisabledReason ? disabledReasonId : undefined}
        onClick={onClick}
        className={cn(
          'inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-45',
          tone === 'cyan'
            ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100 hover:border-cyan-200/50 hover:bg-cyan-300/14'
            : tone === 'amber'
              ? 'border-amber-300/35 bg-amber-300/10 text-amber-100 hover:border-amber-200/50 hover:bg-amber-300/14'
              : 'border-white/10 bg-white/[0.04] text-slate-200',
        )}
      >
        {busy ? <Loader2 size={16} className='animate-spin' /> : <Icon size={16} />}
        {children}
      </button>
      {showDisabledReason ? (
        <p id={disabledReasonId} className='mt-1.5 text-xs leading-5 text-slate-400'>
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}

function getPendingActionStatus(action: PendingAction) {
  const messages: Record<PendingAction, string> = {
    'refresh-merchize': 'Refreshing the latest Merchize order and operational snapshots.',
    'retry-recovery': 'Running the selected post-payment recovery step.',
    'release-production': 'Verifying readiness and requesting Merchize production release.',
    'confirm-address': 'Confirming the current address and rerunning provider readiness checks.',
    'regenerate-receipt': 'Regenerating the receipt from the paid ledger.',
  };

  return messages[action];
}
