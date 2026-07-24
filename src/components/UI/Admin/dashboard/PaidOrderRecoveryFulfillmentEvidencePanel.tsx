'use client';

import {
  Activity,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ImageIcon,
  MapPin,
  PackageCheck,
  ReceiptText,
  Send,
  ShieldCheck,
  TicketCheck,
  TriangleAlert,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/UI/primitives/dialog';
import { cn } from '@/lib/utils';
import { getAdminGlassPanelClassName } from './AdminGlassPanel';
import type { MerchizeFulfillmentOpsAdminSummary } from './adminShopDashboardTypes';

type EvidenceTone = 'good' | 'pending' | 'blocked' | 'neutral';

type EvidenceItem = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: EvidenceTone;
  meaning?: string;
  nextStep?: string;
};

const toneClasses: Record<EvidenceTone, string> = {
  good: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
  pending: 'border-amber-300/20 bg-amber-400/10 text-amber-200',
  blocked: 'border-rose-300/20 bg-rose-400/10 text-rose-200',
  neutral: 'border-slate-300/15 bg-slate-300/8 text-slate-300',
};

const toneMessages: Record<
  EvidenceTone,
  { label: string; meaning: string; nextStep: (itemLabel: string) => string }
> = {
  good: {
    label: 'Healthy',
    meaning: 'The stored provider evidence indicates this check is in a successful state.',
    nextStep: () => 'No corrective action is required. Continue monitoring normal processing.',
  },
  pending: {
    label: 'Waiting',
    meaning: 'This check is incomplete or waiting for newer provider evidence.',
    nextStep: () => 'Refresh Merchize state, then review this item again before releasing.',
  },
  blocked: {
    label: 'Blocking',
    meaning: 'The stored provider evidence indicates a failure or production blocker.',
    nextStep: (label) =>
      `Resolve the ${label.toLowerCase()} issue in Merchize, then refresh the provider state.`,
  },
  neutral: {
    label: 'No conclusion',
    meaning: 'There is not enough stored evidence to classify this item as successful or failed.',
    nextStep: () => 'Refresh Merchize state to request a newer operational snapshot.',
  },
};

function humanizeStatus(value: string | null | undefined, fallback = 'Not checked') {
  if (!value?.trim()) return fallback;

  return value
    .trim()
    .replace(/[_:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getEvidenceTone(value: string | null | undefined): EvidenceTone {
  const normalized = value?.toLowerCase() ?? '';

  if (normalized === 'catalog_managed' || normalized === 'not_required') {
    return 'good';
  }

  if (
    ['blocked', 'failed', 'invalid', 'unavailable', 'cancelled', 'rejected'].some((status) =>
      normalized.includes(status),
    )
  ) {
    return 'blocked';
  }

  if (
    ['pending', 'checking', 'required', 'disabled', 'attention', 'acknowledged'].some((status) =>
      normalized.includes(status),
    )
  ) {
    return 'pending';
  }

  if (
    ['ready', 'verified', 'confirmed', 'fulfilled', 'delivered', 'paid', 'done', 'pushed'].some(
      (status) => normalized.includes(status),
    )
  ) {
    return 'good';
  }

  return 'neutral';
}

function getPushAcknowledgement(summary: MerchizeFulfillmentOpsAdminSummary) {
  const gateStatus = summary.productionGateStatus;
  const acknowledgementStored =
    Boolean(summary.pushAcknowledgedAt) ||
    gateStatus === 'push_acknowledged' ||
    gateStatus === 'push_verification_pending';

  if (acknowledgementStored) {
    return {
      value: 'Acknowledged',
      detail: summary.pushAcknowledgedAt ?? 'Provider acknowledgement stored',
      tone: 'good' as const,
      meaning: 'Merchize acknowledged the production-release command.',
      nextStep: 'Review Push Verification for final provider confirmation.',
    };
  }

  const failed = gateStatus === 'push_failed';
  const disabled = gateStatus === 'push_disabled';
  const pending = gateStatus === 'push_pending';

  return {
    value: humanizeStatus(
      disabled ? 'disabled' : failed ? 'failed' : pending ? 'pending' : 'not_sent',
    ),
    detail: 'No provider acknowledgement recorded',
    tone:
      failed || disabled
        ? ('blocked' as const)
        : pending
          ? ('pending' as const)
          : ('neutral' as const),
    meaning: failed
      ? (summary.lastSyncErrorMessage ?? 'Merchize rejected the production-release command.')
      : disabled
        ? 'Automatic production release is disabled by configuration.'
        : pending
          ? 'The production-release command is awaiting provider acknowledgement.'
          : 'No production-release command has been recorded.',
    nextStep: failed
      ? 'Review the Merchize error, correct the cause, and retry the fulfillment handoff.'
      : disabled
        ? 'A master admin can review manual release after all non-bypassable checks are clear.'
        : pending
          ? 'Refresh Merchize state to check for provider acknowledgement.'
          : 'Resolve readiness blockers before requesting production release.',
  };
}

function getPushVerification(summary: MerchizeFulfillmentOpsAdminSummary) {
  if (summary.pushVerifiedAt || summary.productionGateStatus === 'push_verified') {
    return {
      value: 'Verified',
      detail: summary.pushVerifiedAt ?? 'Provider push state verified',
      tone: 'good' as const,
      meaning: 'Merchize verified that the order was released to production.',
      nextStep: 'No corrective action is required. Continue monitoring fulfillment progress.',
    };
  }

  if (summary.productionGateStatus === 'push_failed') {
    return {
      value: 'Failed',
      detail: 'Provider reported a failed push',
      tone: 'blocked' as const,
      meaning: summary.lastSyncErrorMessage ?? 'Merchize could not verify the production release.',
      nextStep: 'Review the Merchize error, correct the cause, and retry verification.',
    };
  }

  if (
    summary.pushAcknowledgedAt ||
    summary.productionGateStatus === 'push_acknowledged' ||
    summary.productionGateStatus === 'push_verification_pending'
  ) {
    return {
      value: 'Verification pending',
      detail: humanizeStatus(summary.providerPushProgress, 'Waiting for provider state'),
      tone: 'pending' as const,
      meaning: 'The release command was acknowledged, but final provider verification is pending.',
      nextStep: 'Refresh Merchize state to check for final production confirmation.',
    };
  }

  return {
    value: 'Not started',
    detail: humanizeStatus(summary.providerPushProgress, 'No verified provider release'),
    tone: 'neutral' as const,
    meaning: 'Production verification has not started because no acknowledged release is stored.',
    nextStep: 'Resolve readiness blockers and send the production-release command first.',
  };
}

function EvidenceCell({ item, className }: { item: EvidenceItem; className?: string }) {
  const Icon = item.icon;
  const tone = item.tone ?? getEvidenceTone(item.value);
  const message = toneMessages[tone];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type='button'
          aria-label={`View ${item.label} evidence: ${item.value}`}
          className={cn(
            'group/evidence flex min-w-0 items-start gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.04] focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-200/70 sm:px-5',
            className,
          )}
        >
          <span className='mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-400 transition group-hover/evidence:border-cyan-300/20 group-hover/evidence:text-cyan-100'>
            <Icon size={16} aria-hidden='true' />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='flex items-start justify-between gap-2'>
              <span className='text-xs font-medium text-slate-300'>{item.label}</span>
              <ChevronRight
                size={14}
                aria-hidden='true'
                className='mt-0.5 shrink-0 text-slate-500 transition group-hover/evidence:translate-x-0.5 group-hover/evidence:text-cyan-100'
              />
            </span>
            <span
              className={cn(
                'mt-1.5 inline-flex max-w-full rounded-md border px-2 py-1 text-xs font-medium',
                toneClasses[tone],
              )}
            >
              <span className='break-words'>{item.value}</span>
            </span>
            <span className='mt-1.5 block break-words text-xs leading-5 text-slate-400'>
              {item.detail}
            </span>
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className='max-h-[min(86vh,680px)] w-[min(94vw,560px)] overflow-y-auto rounded-xl border border-white/15 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'>
        <DialogHeader>
          <div className='flex items-start gap-3 pr-8 text-left'>
            <span className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-cyan-100'>
              <Icon size={19} aria-hidden='true' />
            </span>
            <div>
              <DialogTitle className='text-white'>{item.label}</DialogTitle>
              <DialogDescription className='mt-1 text-sm leading-6 text-slate-300'>
                Fulfillment evidence and operational guidance for this status.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='rounded-lg border border-white/10 bg-white/[0.03] p-3.5'>
            <p className='text-xs font-medium text-slate-400'>Current status</p>
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              <span
                className={cn(
                  'inline-flex rounded-md border px-2.5 py-1 text-sm font-semibold',
                  toneClasses[tone],
                )}
              >
                {item.value}
              </span>
              <span className='text-sm font-medium text-slate-200'>{message.label}</span>
            </div>
          </div>

          <EvidenceDialogSection title='Stored evidence' body={item.detail} />
          <EvidenceDialogSection title='What this means' body={item.meaning ?? message.meaning} />
          <EvidenceDialogSection
            title='Recommended next step'
            body={item.nextStep ?? message.nextStep(item.label)}
          />
        </div>

        <DialogFooter>
          <DialogClose className='inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60'>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceDialogSection({ title, body }: { title: string; body: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-black/20 p-3.5'>
      <p className='text-xs font-medium text-slate-400'>{title}</p>
      <p className='mt-1.5 text-sm leading-6 text-slate-100'>{body}</p>
    </div>
  );
}

function buildReadinessItems(summary: MerchizeFulfillmentOpsAdminSummary): EvidenceItem[] {
  const pushAcknowledgement = getPushAcknowledgement(summary);
  const pushVerification = getPushVerification(summary);
  const ageStatus = summary.manualReleaseRequired
    ? 'Manual release required'
    : summary.lastReadinessCheckAt
      ? 'No age hold'
      : 'Not checked';

  return [
    {
      label: 'Address',
      value: humanizeStatus(summary.addressReviewStatus),
      detail:
        summary.addressValidationStatus || summary.addressReadbackStatus
          ? `Validation ${humanizeStatus(summary.addressValidationStatus)} · Read-back ${humanizeStatus(summary.addressReadbackStatus)}`
          : summary.lastAddressCheckAt ?? 'No address evidence stored',
      icon: MapPin,
      tone: getAddressEvidenceTone(summary),
      ...getAddressDialogCopy(summary),
    },
    {
      label: 'Products',
      value: humanizeStatus(summary.itemReviewStatus),
      detail: `${summary.itemCount} normalized provider item${summary.itemCount === 1 ? '' : 's'}`,
      icon: PackageCheck,
      ...getReadinessDialogCopy(
        summary,
        'items',
        'All mapped products and variants passed provider readiness checks.',
        'Restore the blocked product or variant mapping in Merchize, then refresh provider state.',
      ),
    },
    {
      label: 'Artwork',
      value: humanizeStatus(summary.artworkReviewStatus),
      detail: summary.lastReadinessCheckAt ?? 'No artwork evidence stored',
      icon: ImageIcon,
      ...getReadinessDialogCopy(
        summary,
        'artwork',
        summary.artworkReviewStatus === 'catalog_managed'
          ? 'This order uses a resolved stored Merchize catalog variant, so the order-level missing-artwork flag does not require a separate artwork-set import.'
          : 'No separate production-artwork repair is required by the current provider evidence.',
        'Attach or repair the required production artwork in Merchize, then refresh provider state.',
      ),
    },
    {
      label: 'Invoice',
      value: humanizeStatus(summary.costReviewStatus),
      detail: summary.lastCostCheckAt ?? 'No fulfillment-cost evidence stored',
      icon: CircleDollarSign,
      ...getCostDialogCopy(summary),
    },
    {
      label: 'Attention',
      value: humanizeStatus(summary.attentionReviewStatus),
      detail:
        summary.attentionReviewStatus === 'blocked'
          ? 'Provider attention must be resolved'
          : summary.attentionReviewStatus === 'ready'
            ? 'No blocking provider attention stored'
            : 'No provider-attention decision stored',
      icon: TriangleAlert,
      ...getReadinessDialogCopy(
        summary,
        'attention',
        'No unresolved provider attention requests were returned.',
        'Resolve the provider attention request in Merchize, then refresh provider state.',
      ),
    },
    {
      label: 'Age Gate',
      value: ageStatus,
      detail: summary.lastReadinessCheckAt ?? 'No readiness decision stored',
      icon: CalendarClock,
      tone: summary.manualReleaseRequired
        ? 'pending'
        : summary.lastReadinessCheckAt
          ? 'good'
          : 'neutral',
      ...getReadinessDialogCopy(
        summary,
        'age',
        'The order does not require a master-admin age override.',
        'Use the manual release review after all non-bypassable checks are clear.',
      ),
    },
    {
      label: 'Push Command',
      icon: Send,
      ...pushAcknowledgement,
    },
    {
      label: 'Push Verification',
      icon: BadgeCheck,
      ...pushVerification,
    },
  ];
}

function getReadinessDialogCopy(
  summary: MerchizeFulfillmentOpsAdminSummary,
  category: string,
  clearMeaning: string,
  blockedNextStep: string,
): Pick<EvidenceItem, 'meaning' | 'nextStep'> {
  if (!summary.readinessStatus) return {};

  const blocker = summary.readinessBlockers.find((item) => item.category === category);

  return blocker
    ? {
        meaning: blocker.message,
        nextStep: blocker.retryable
          ? 'Refresh Merchize state to request newer provider evidence.'
          : blockedNextStep,
      }
    : {
        meaning: clearMeaning,
        nextStep: 'No corrective action is required. Continue monitoring normal processing.',
      };
}

function getAddressDialogCopy(
  summary: MerchizeFulfillmentOpsAdminSummary,
): Pick<EvidenceItem, 'meaning' | 'nextStep'> {
  const blocker = summary.readinessBlockers.find((item) => item.category === 'address');
  if (blocker) {
    return {
      meaning: blocker.message,
      nextStep: blocker.retryable
        ? 'Refresh Merchize state to request newer provider evidence.'
        : 'Correct or explicitly confirm the address in Merchize, then refresh provider state.',
    };
  }

  if (summary.addressReadbackStatus === 'matched') {
    return {
      meaning:
        summary.addressValidationStatus === 'other' ||
        summary.addressValidationStatus === 'others'
          ? 'The provider address fields match the effective ledger address. Merchize classifies the destination outside its US address-validation scope.'
          : 'The provider address fields match the effective ledger address, and no address-validation blocker is stored.',
      nextStep: 'No address correction is required. Continue with the remaining release checks.',
    };
  }

  if (summary.readinessStatus) {
    return {
      meaning:
        'Provider validation evidence is stored, but an exact buyer-details comparison was not included in this readiness snapshot.',
      nextStep: 'Refresh Merchize state before releasing the order.',
    };
  }

  return {};
}

function getAddressEvidenceTone(summary: MerchizeFulfillmentOpsAdminSummary): EvidenceTone {
  const reviewTone = getEvidenceTone(summary.addressReviewStatus);
  if (reviewTone === 'blocked') return 'blocked';
  if (summary.addressReadbackStatus === 'mismatch') return 'blocked';
  if (summary.addressReadbackStatus === 'matched') return reviewTone;
  return summary.readinessStatus ? 'pending' : 'neutral';
}

function getCostDialogCopy(
  summary: MerchizeFulfillmentOpsAdminSummary,
): Pick<EvidenceItem, 'meaning' | 'nextStep'> {
  const status = summary.costReviewStatus?.toLowerCase();

  if (status === 'awaiting_fulfillment') {
    return {
      meaning:
        'Merchize accepted the invoice-statistics request but has not generated a fulfillment-cost record yet. A numeric zero is a pre-fulfillment placeholder, not a product error.',
      nextStep:
        'Resolve the independent release checks and continue fulfillment. Refresh invoice evidence after the push.',
    };
  }
  if (status === 'pending') {
    return {
      meaning:
        'The order is pushed, but Merchize has not returned a structured fulfillment-cost record yet.',
      nextStep: 'Allow the lifecycle scanner to refresh the invoice, or verify provider state.',
    };
  }
  if (status === 'paid') {
    return {
      meaning: 'Merchize returned a structured fulfillment-cost record marked as paid.',
      nextStep: 'No invoice action is required. Continue lifecycle monitoring.',
    };
  }
  if (status === 'available') {
    return {
      meaning: 'Merchize returned a structured fulfillment-cost record.',
      nextStep: 'Review its payment status during normal lifecycle monitoring.',
    };
  }

  return getReadinessDialogCopy(
    summary,
    'cost',
    'No invoice error is currently recorded.',
    'Retry the documented invoice-statistics request, then refresh provider state.',
  );
}

function buildOperationalItems(summary: MerchizeFulfillmentOpsAdminSummary): EvidenceItem[] {
  return [
    {
      label: 'Progress',
      value: humanizeStatus(
        summary.progressStatus,
        summary.lastProgressSyncAt ? 'Snapshot stored' : 'Not synced',
      ),
      detail: summary.lastProgressSyncAt
        ? `Progress ${summary.lastProgressSyncAt}${
            summary.lastHistorySyncAt ? ` · History ${summary.lastHistorySyncAt}` : ''
          }`
        : 'No progress snapshot stored',
      icon: Activity,
    },
    {
      label: 'Tracking',
      value: humanizeStatus(
        summary.deliveryStatus,
        summary.lastTrackingSyncAt ? 'Checked, not available' : 'Not synced',
      ),
      detail: summary.lastTrackingSyncAt ?? 'No tracking snapshot stored',
      icon: Truck,
      tone: getDeliveryTone(summary.deliveryStatus),
      meaning: summary.deliveryStatus
        ? `The latest provider delivery state is ${humanizeStatus(summary.deliveryStatus).toLowerCase()}.`
        : summary.lastTrackingSyncAt
          ? 'Tracking was checked, but the provider has not published a shipment update.'
          : 'No tracking snapshot has been requested yet.',
      nextStep: summary.deliveryStatus
        ? 'Continue monitoring the provider delivery state.'
        : 'Refresh Merchize state after the order ships to request tracking evidence.',
    },
    {
      label: 'Invoice',
      value: summary.lastCostCheckAt ? 'Snapshot stored' : 'Not synced',
      detail: summary.lastCostCheckAt ?? 'No invoice snapshot stored',
      icon: ReceiptText,
      tone: 'neutral',
      meaning: summary.lastCostCheckAt
        ? 'The latest accounting snapshot was stored. Invoice, charge, and refund data are operational evidence; their mere presence does not independently approve or block release.'
        : 'No accounting snapshot has been stored.',
      nextStep:
        'Use Invoice above for the current request state. Refresh Merchize state when newer accounting evidence is needed.',
    },
    {
      label: 'Tickets',
      value: summary.lastTicketSyncAt ? 'Snapshot stored' : 'Not synced',
      detail: summary.lastTicketSyncAt ?? 'No ticket snapshot stored',
      icon: TicketCheck,
      tone: 'neutral',
      meaning: summary.lastTicketSyncAt
        ? 'The existing provider-ticket snapshot was stored for support context. Tickets do not automatically block production readiness.'
        : 'No provider-ticket snapshot has been stored.',
      nextStep:
        'Use Attention above for the release gate. Review tickets separately when support context is needed.',
    },
  ];
}

function getDeliveryTone(value: string | null): EvidenceTone {
  const normalized = value?.toLowerCase() ?? '';

  if (
    ['failed', 'error', 'returned', 'rejected', 'cancelled'].some((token) =>
      normalized.includes(token),
    )
  ) {
    return 'blocked';
  }

  if (['delivered', 'fulfilled'].some((token) => normalized.includes(token))) return 'good';
  if (
    ['shipped', 'transit', 'processing', 'out_for_delivery'].some((token) =>
      normalized.includes(token),
    )
  ) {
    return 'pending';
  }

  return 'neutral';
}

function getEvidenceCellClassName(index: number, embedded: boolean) {
  return cn(
    index > 0 && 'border-t border-white/10',
    index === 1 && 'sm:border-t-0',
    index % 2 === 0 && 'sm:border-r sm:border-white/10',
    !embedded && index < 4 && 'xl:border-t-0',
    !embedded && index % 4 !== 3 && 'xl:border-r xl:border-white/10',
  );
}

export default function PaidOrderRecoveryFulfillmentEvidencePanel({
  summary,
  embedded = false,
}: {
  summary: MerchizeFulfillmentOpsAdminSummary | null;
  embedded?: boolean;
}) {
  return (
    <div
      className={
        embedded
          ? 'overflow-hidden rounded-lg border border-white/10 bg-black/15'
          : getAdminGlassPanelClassName('overflow-hidden')
      }
    >
      <div className='flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5'>
        <div className='flex items-start gap-3'>
          <span className='grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200'>
            <ShieldCheck size={18} />
          </span>
          <div>
            <h3 className='text-sm font-semibold text-white'>Fulfillment evidence</h3>
            <p className='mt-1 text-sm leading-6 text-slate-300'>
              Provider readiness, release, and lifecycle state.
            </p>
          </div>
        </div>
        {summary?.lastReadinessCheckAt ? (
          <span className='inline-flex items-center gap-1.5 text-xs text-slate-400'>
            <Clock3 size={13} />
            {summary.lastReadinessCheckAt}
          </span>
        ) : null}
      </div>

      {summary ? (
        <>
          <div className={cn('grid sm:grid-cols-2', !embedded && 'xl:grid-cols-4')}>
            {buildReadinessItems(summary).map((item, index) => (
              <EvidenceCell
                key={item.label}
                item={item}
                className={getEvidenceCellClassName(index, embedded)}
              />
            ))}
          </div>

          <div className='border-t border-white/10'>
            <div className='px-4 py-2.5 sm:px-5'>
              <p className='text-xs font-medium text-slate-400'>Operational snapshots</p>
            </div>
            <div
              className={cn(
                'grid border-t border-white/10 sm:grid-cols-2',
                !embedded && 'xl:grid-cols-4',
              )}
            >
              {buildOperationalItems(summary).map((item, index) => (
                <EvidenceCell
                  key={item.label}
                  item={item}
                  className={getEvidenceCellClassName(index, embedded)}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className='px-4 py-6 text-sm text-slate-400 sm:px-5'>
          Provider fulfillment evidence has not been registered for this order.
        </div>
      )}
    </div>
  );
}
