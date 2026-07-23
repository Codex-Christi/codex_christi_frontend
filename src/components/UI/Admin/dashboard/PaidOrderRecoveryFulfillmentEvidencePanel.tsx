import {
  Activity,
  BadgeCheck,
  CalendarClock,
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
import { cn } from '@/lib/utils';
import AdminGlassPanel from './AdminGlassPanel';
import type { MerchizeFulfillmentOpsAdminSummary } from './adminShopDashboardTypes';

type EvidenceTone = 'good' | 'pending' | 'blocked' | 'neutral';

type EvidenceItem = {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: EvidenceTone;
};

const toneClasses: Record<EvidenceTone, string> = {
  good: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200',
  pending: 'border-amber-300/20 bg-amber-400/10 text-amber-200',
  blocked: 'border-rose-300/20 bg-rose-400/10 text-rose-200',
  neutral: 'border-slate-300/15 bg-slate-300/8 text-slate-300',
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
  if (summary.pushAcknowledgedAt) {
    return {
      value: 'Acknowledged',
      detail: summary.pushAcknowledgedAt,
      tone: 'pending' as const,
    };
  }

  const gateStatus = summary.productionGateStatus;
  return {
    value: humanizeStatus(
      gateStatus === 'push_disabled'
        ? 'disabled'
        : gateStatus === 'push_failed'
          ? 'failed'
          : gateStatus === 'push_pending'
            ? 'pending'
            : 'not_sent',
    ),
    detail: 'No provider acknowledgement recorded',
    tone: getEvidenceTone(gateStatus),
  };
}

function getPushVerification(summary: MerchizeFulfillmentOpsAdminSummary) {
  if (summary.pushVerifiedAt || summary.productionGateStatus === 'push_verified') {
    return {
      value: 'Verified',
      detail: summary.pushVerifiedAt ?? 'Provider push state verified',
      tone: 'good' as const,
    };
  }

  if (summary.productionGateStatus === 'push_failed') {
    return {
      value: 'Failed',
      detail: 'Provider reported a failed push',
      tone: 'blocked' as const,
    };
  }

  if (summary.pushAcknowledgedAt) {
    return {
      value: 'Verification pending',
      detail: humanizeStatus(summary.providerPushProgress, 'Waiting for provider state'),
      tone: 'pending' as const,
    };
  }

  return {
    value: 'Not started',
    detail: humanizeStatus(summary.providerPushProgress, 'No verified provider release'),
    tone: 'neutral' as const,
  };
}

function EvidenceCell({ item }: { item: EvidenceItem }) {
  const Icon = item.icon;
  const tone = item.tone ?? getEvidenceTone(item.value);

  return (
    <div className='min-w-0 px-4 py-3.5 sm:px-5'>
      <div className='flex items-start gap-3'>
        <span className='mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-400'>
          <Icon size={16} />
        </span>
        <div className='min-w-0'>
          <p className='text-[10px] uppercase tracking-[0.1em] text-slate-500'>{item.label}</p>
          <span
            className={cn(
              'mt-1.5 inline-flex max-w-full rounded-md border px-2 py-1 text-[11px] font-medium',
              toneClasses[tone],
            )}
          >
            <span className='truncate'>{item.value}</span>
          </span>
          <p className='mt-1.5 break-words text-xs leading-5 text-slate-500'>{item.detail}</p>
        </div>
      </div>
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
      detail: summary.lastAddressCheckAt ?? 'No address evidence stored',
      icon: MapPin,
    },
    {
      label: 'Products',
      value: humanizeStatus(summary.itemReviewStatus),
      detail: `${summary.itemCount} normalized provider item${summary.itemCount === 1 ? '' : 's'}`,
      icon: PackageCheck,
    },
    {
      label: 'Artwork',
      value: humanizeStatus(summary.artworkReviewStatus),
      detail: summary.lastReadinessCheckAt ?? 'No artwork evidence stored',
      icon: ImageIcon,
    },
    {
      label: 'Cost',
      value: humanizeStatus(summary.costReviewStatus),
      detail: summary.lastCostCheckAt ?? 'No fulfillment-cost evidence stored',
      icon: CircleDollarSign,
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
    },
    {
      label: 'Push Command',
      value: pushAcknowledgement.value,
      detail: pushAcknowledgement.detail,
      icon: Send,
      tone: pushAcknowledgement.tone,
    },
    {
      label: 'Push Verification',
      value: pushVerification.value,
      detail: pushVerification.detail,
      icon: BadgeCheck,
      tone: pushVerification.tone,
    },
  ];
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
    },
    {
      label: 'Invoice',
      value: humanizeStatus(
        summary.costReviewStatus,
        summary.lastCostCheckAt ? 'Snapshot stored' : 'Not synced',
      ),
      detail: summary.lastCostCheckAt ?? 'No invoice snapshot stored',
      icon: ReceiptText,
    },
    {
      label: 'Tickets',
      value: summary.lastTicketSyncAt
        ? summary.attentionReviewStatus === 'blocked'
          ? 'Attention required'
          : 'Snapshot stored'
        : 'Not synced',
      detail: summary.lastTicketSyncAt ?? 'No ticket snapshot stored',
      icon: TicketCheck,
      tone:
        summary.attentionReviewStatus === 'blocked'
          ? 'blocked'
          : summary.lastTicketSyncAt
            ? 'good'
            : 'neutral',
    },
  ];
}

export default function PaidOrderRecoveryFulfillmentEvidencePanel({
  summary,
}: {
  summary: MerchizeFulfillmentOpsAdminSummary | null;
}) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5'>
        <div className='flex items-start gap-3'>
          <span className='grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200'>
            <ShieldCheck size={18} />
          </span>
          <div>
            <h3 className='text-sm font-semibold text-white'>Fulfillment Evidence</h3>
            <p className='mt-1 text-xs text-slate-500'>
              Provider readiness, release, and lifecycle state.
            </p>
          </div>
        </div>
        {summary?.lastReadinessCheckAt ? (
          <span className='inline-flex items-center gap-1.5 text-xs text-slate-500'>
            <Clock3 size={13} />
            {summary.lastReadinessCheckAt}
          </span>
        ) : null}
      </div>

      {summary ? (
        <>
          <div className='grid divide-y divide-white/10 sm:grid-cols-2 sm:[&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(odd)]:border-white/10 xl:grid-cols-4 xl:[&>*:not(:nth-child(4n))]:border-r xl:[&>*:not(:nth-child(4n))]:border-white/10 xl:[&>*:nth-child(odd)]:border-r'>
            {buildReadinessItems(summary).map((item) => (
              <EvidenceCell key={item.label} item={item} />
            ))}
          </div>

          <div className='border-t border-white/10'>
            <div className='px-4 py-2.5 sm:px-5'>
              <p className='text-[10px] uppercase tracking-[0.1em] text-slate-500'>
                Operational Snapshots
              </p>
            </div>
            <div className='grid border-t border-white/10 divide-y divide-white/10 sm:grid-cols-2 sm:[&>*:nth-child(odd)]:border-r sm:[&>*:nth-child(odd)]:border-white/10 xl:grid-cols-4 xl:divide-y-0 xl:[&>*:not(:last-child)]:border-r xl:[&>*:not(:last-child)]:border-white/10'>
              {buildOperationalItems(summary).map((item) => (
                <EvidenceCell key={item.label} item={item} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className='px-4 py-6 text-sm text-slate-500 sm:px-5'>
          Provider fulfillment evidence has not been registered for this order.
        </div>
      )}
    </AdminGlassPanel>
  );
}
