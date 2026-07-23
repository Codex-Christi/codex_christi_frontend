import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileCheck2,
  ReceiptText,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminCopyValueButton from './AdminCopyValueButton';
import AdminGlassPanel from './AdminGlassPanel';
import PaidOrderRecoveryFulfillmentEvidencePanel from './PaidOrderRecoveryFulfillmentEvidencePanel';
import { AdminPaidOrderRecoveryStatusBadge } from './AdminStatusBadge';
import type {
  MerchizeFulfillmentOpsAdminSummary,
  PaidOrderRecoveryDetail,
  PaidOrderRecoveryRow,
  TimelineItem,
} from './adminShopDashboardTypes';

type ReadinessState = 'ready' | 'pending' | 'blocked';

type ReadinessCheck = {
  label: string;
  state: ReadinessState;
  value: string;
  message?: string;
  category: string;
  bypassable?: boolean;
};

export function getPaidOrderReadinessChecks(
  summary: MerchizeFulfillmentOpsAdminSummary | null,
): ReadinessCheck[] {
  if (!summary) {
    return [
      {
        label: 'Merchize readiness',
        state: 'pending',
        value: 'Evidence unavailable',
        category: 'provider',
      },
    ];
  }

  const checks = [
    { label: 'Address', value: summary.addressReviewStatus, category: 'address' },
    { label: 'Products', value: summary.itemReviewStatus, category: 'items' },
    { label: 'Artwork', value: summary.artworkReviewStatus, category: 'artwork' },
    { label: 'Invoice', value: summary.costReviewStatus, category: 'cost' },
    {
      label: 'Provider attention',
      value: summary.attentionReviewStatus,
      category: 'attention',
    },
  ];

  if (summary.readinessStatus) {
    const categoryChecks = checks.map((check) => {
      const blocker = summary.readinessBlockers.find(
        (candidate) => candidate.category === check.category,
      );

      return blocker
        ? {
            label: check.label,
            state: blocker.retryable ? ('pending' as const) : ('blocked' as const),
            value: check.value ?? blocker.code,
            message: blocker.message,
            category: check.category,
          }
        : {
            label: check.label,
            state: 'ready' as const,
            value: check.value ?? 'clear',
            category: check.category,
          };
    });
    const knownCategories = new Set(checks.map((check) => check.category));
    const additionalChecks = summary.readinessBlockers
      .filter((blocker) => !knownCategories.has(blocker.category))
      .map((blocker) => ({
        label: blocker.category === 'age' ? 'Age gate' : humanize(blocker.category),
        state:
          blocker.retryable || blocker.category === 'age'
            ? ('pending' as const)
            : ('blocked' as const),
        value: blocker.category === 'age' ? 'manual_release_required' : blocker.code,
        message: blocker.message,
        category: blocker.category,
        bypassable: blocker.category === 'age',
      }));

    if (
      !summary.readinessBlockers.length &&
      !['ready', 'already_pushed'].includes(summary.readinessStatus)
    ) {
      return [
        {
          label: 'Merchize readiness',
          state: summary.readinessStatus === 'blocked' ? 'blocked' : 'pending',
          value: summary.readinessStatus,
          category: 'provider',
        },
      ];
    }

    return [...categoryChecks, ...additionalChecks];
  }

  return checks.map((check) =>
    toReadinessCheck(
      check.label,
      check.value,
      [
        'ready',
        ...(check.category === 'address' ? ['buyer_confirmed'] : []),
        ...(check.category === 'artwork' ? ['catalog_managed', 'not_required'] : []),
      ],
      check.category,
    ),
  );
}

export function getManualReleaseReadinessWarning(
  summary: MerchizeFulfillmentOpsAdminSummary | null,
) {
  const unresolved = getPaidOrderReadinessChecks(summary).filter(
    (check) => check.state !== 'ready',
  );
  const nonBypassable = unresolved.filter((check) => !check.bypassable);
  const hasAgeGate = unresolved.some((check) => check.bypassable);

  if (!unresolved.length) return null;

  if (!nonBypassable.length) {
    return 'Only the seven-day age gate remains. Release will rerun all non-bypassable checks before applying the permitted master-admin age override.';
  }

  return `The current snapshot shows ${formatList(
    nonBypassable.map((check) => check.label.toLowerCase()),
  )} unresolved. ${
    hasAgeGate
      ? 'The age gate can be overridden here, but release proceeds only if those checks clear.'
      : 'Release will rerun these checks and proceed only if they clear.'
  }`;
}

export function PaidOrderRecoveryCaseSummary({
  recovery,
  detail,
}: {
  recovery: PaidOrderRecoveryRow;
  detail: PaidOrderRecoveryDetail;
}) {
  return (
    <AdminGlassPanel className='self-start overflow-hidden'>
      <div className='flex flex-col gap-5 p-5 sm:p-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100'>
              Recovery case
            </p>
            <h2 className='mt-2 text-3xl font-semibold tracking-tight text-white'>
              {recovery.supportRef}
            </h2>
            <p className='mt-2 break-all text-sm text-slate-300'>{detail.customerEmail}</p>
          </div>
          <AdminPaidOrderRecoveryStatusBadge status={recovery.status} />
        </div>

        <dl className='grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2'>
          <div>
            <dt className='text-xs font-medium text-slate-400'>Current stage</dt>
            <dd className='mt-1 text-base font-medium leading-6 text-slate-100'>{recovery.step}</dd>
          </div>
          <div>
            <dt className='text-xs font-medium text-slate-400'>Last updated</dt>
            <dd className='mt-1 text-sm leading-6 text-slate-200'>{detail.updatedAt}</dd>
          </div>
        </dl>
      </div>
    </AdminGlassPanel>
  );
}

export function PaidOrderRecoveryPaymentEvidencePanel({
  recovery,
  detail,
}: {
  recovery: PaidOrderRecoveryRow;
  detail: PaidOrderRecoveryDetail;
}) {
  const evidence = detail.paymentEvidence;

  return (
    <AdminGlassPanel className='h-full overflow-hidden'>
      <div className='border-b border-white/10 px-5 py-4 sm:px-6'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.1em] text-emerald-200'>
              Payment & receipt
            </p>
            <h3 className='mt-1 text-base font-semibold text-white'>Financial truth</h3>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold',
              evidence.captured
                ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                : 'border-amber-300/25 bg-amber-300/10 text-amber-100',
            )}
          >
            {evidence.captured ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {evidence.captured ? 'Payment captured' : 'Capture needs review'}
          </span>
        </div>
      </div>

      <div className='space-y-5 p-5 sm:p-6'>
        <div>
          <p className='text-3xl font-semibold tracking-tight text-white'>
            {evidence.amount ?? recovery.amount}
          </p>
          <p className='mt-1 text-sm text-slate-300'>
            PayPal ·{' '}
            {evidence.captured
              ? 'completed capture evidence'
              : humanize(evidence.status ?? 'capture needs review')}
          </p>
        </div>

        <div
          className={cn(
            'rounded-lg border px-3.5 py-3 text-sm leading-6',
            evidence.captured
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-50'
              : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-50',
          )}
        >
          <div className='flex items-start gap-2.5'>
            <ShieldCheck size={17} className='mt-1 shrink-0' />
            <p>
              {evidence.captured
                ? 'Recovery actions continue after payment and do not capture the customer again.'
                : evidence.proof}
            </p>
          </div>
        </div>

        <dl className='grid gap-3 text-sm sm:grid-cols-2'>
          <EvidenceValue
            icon={CircleDollarSign}
            label='PayPal capture ID'
            value={evidence.captureId}
          />
          <EvidenceValue
            icon={ReceiptText}
            label='PayPal order ID'
            value={evidence.paypalOrderId}
          />
          <EvidenceValue
            icon={FileCheck2}
            label='Django payment record'
            value={evidence.djangoPaymentSaved ? 'Saved' : 'Not saved'}
          />
          <div className='rounded-lg border border-white/10 bg-white/[0.03] p-3'>
            <dt className='flex items-center gap-2 text-xs font-medium text-slate-400'>
              <ReceiptText size={14} />
              Customer receipt
            </dt>
            <dd className='mt-2'>
              {detail.receiptLink ? (
                <a
                  href={detail.receiptLink}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex items-center gap-2 text-sm font-medium text-cyan-100 underline decoration-cyan-300/30 underline-offset-4 hover:text-cyan-50'
                >
                  Open receipt
                  <ExternalLink size={13} />
                </a>
              ) : (
                <span className='text-slate-300'>Not prepared</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </AdminGlassPanel>
  );
}

export function PaidOrderRecoveryBlockerPanel({
  recovery,
  detail,
}: {
  recovery: PaidOrderRecoveryRow;
  detail: PaidOrderRecoveryDetail;
}) {
  const checks = getPaidOrderReadinessChecks(detail.merchizeFulfillmentOps);
  const unresolved = checks.filter((check) => check.state !== 'ready');
  const recommendedAction = getRecommendedAction(recovery, detail, unresolved);
  const isComplete = recovery.status === 'completed';
  const hasBlockingError =
    recovery.error !== '—' && ['attention', 'failed'].includes(recovery.status);
  const hasProgressMessage = !isComplete && recovery.error !== '—' && !hasBlockingError;
  const hasCurrentBlocker = !isComplete && (unresolved.length > 0 || hasBlockingError);

  return (
    <AdminGlassPanel
      className={cn(
        'overflow-hidden',
        isComplete
          ? 'border-emerald-300/20'
          : hasCurrentBlocker
            ? 'border-amber-300/20'
            : 'border-cyan-300/20',
      )}
    >
      <div className='border-b border-white/10 px-4 py-4 sm:px-5'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <p
              className={cn(
                'text-xs font-semibold uppercase tracking-[0.1em]',
                isComplete
                  ? 'text-emerald-200'
                  : hasCurrentBlocker
                    ? 'text-amber-200'
                    : 'text-cyan-100',
              )}
            >
              {isComplete ? 'Recovery complete' : hasCurrentBlocker ? 'Needs action' : 'Ready'}
            </p>
            <h3 className='mt-1 text-base font-semibold text-white'>{recovery.step}</h3>
          </div>
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              isComplete
                ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                : hasCurrentBlocker
                  ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
                  : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100',
            )}
          >
            {isComplete
              ? 'No action required'
              : unresolved.length
                ? `${unresolved.length} unresolved`
                : 'Checks clear'}
          </span>
        </div>
      </div>

      <div className='space-y-4 p-4 sm:p-5'>
        {hasBlockingError ? (
          <div className='rounded-lg border border-rose-300/20 bg-rose-300/[0.07] p-3.5'>
            <p className='text-xs font-medium text-rose-200'>Current blocker</p>
            <p className='mt-1.5 break-words text-sm font-medium leading-6 text-slate-50'>
              {recovery.error}
            </p>
          </div>
        ) : null}

        {hasProgressMessage ? (
          <div className='rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] p-3.5'>
            <p className='text-xs font-medium text-cyan-100'>Current state</p>
            <p className='mt-1.5 break-words text-sm font-medium leading-6 text-slate-50'>
              {recovery.error}
            </p>
          </div>
        ) : null}

        {isComplete ? (
          <p className='rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-2.5 text-sm text-emerald-50'>
            Post-payment processing is complete. No recovery mutation is required.
          </p>
        ) : unresolved.length ? (
          <div>
            <p className='text-xs font-medium text-slate-300'>Readiness checks and release gates</p>
            <ul className='mt-2 space-y-2'>
              {unresolved.map((check) => (
                <li
                  key={check.label}
                  className='flex items-start justify-between gap-3 rounded-md border border-white/10 bg-black/15 px-3 py-2 text-sm'
                >
                  <span className='text-slate-200'>
                    {check.label}
                    {check.message ? (
                      <span className='mt-1 block text-xs leading-5 text-slate-400'>
                        {check.message}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      'font-medium',
                      check.state === 'blocked' ? 'text-rose-200' : 'text-amber-200',
                    )}
                  >
                    {humanize(check.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className='rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-2.5 text-sm text-emerald-50'>
            Non-bypassable Merchize readiness checks are clear.
          </p>
        )}

        <div className='rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] p-3.5'>
          <p className='text-xs font-medium text-cyan-100'>Recommended next step</p>
          <p className='mt-1.5 text-sm font-medium leading-6 text-white'>{recommendedAction}</p>
        </div>

        {detail.merchizeFulfillmentOps?.lastReadinessCheckAt ? (
          <p className='flex items-center gap-2 text-xs text-slate-400'>
            <Clock3 size={13} />
            Last checked {detail.merchizeFulfillmentOps.lastReadinessCheckAt}
          </p>
        ) : null}
      </div>
    </AdminGlassPanel>
  );
}

export function PaidOrderRecoveryPostPaymentPipeline({
  timeline,
  detail,
}: {
  timeline: TimelineItem[];
  detail: PaidOrderRecoveryDetail;
}) {
  const checks = getPaidOrderReadinessChecks(detail.merchizeFulfillmentOps);
  const blockerCount = checks.filter((check) => check.state === 'blocked').length;
  const pendingCount = checks.filter((check) => check.state === 'pending').length;

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.1em] text-cyan-100'>
            Post-payment recovery
          </p>
          <h3 className='mt-1 text-base font-semibold text-white'>Processing pipeline</h3>
          <p className='mt-1 text-sm leading-6 text-slate-300'>
            One view of payment handoff, backend processing, and Merchize readiness.
          </p>
        </div>
        <div className='flex flex-wrap gap-2 text-xs font-semibold'>
          {blockerCount ? (
            <span className='rounded-full border border-rose-300/25 bg-rose-300/10 px-3 py-1 text-rose-100'>
              {blockerCount} blocked
            </span>
          ) : null}
          {pendingCount ? (
            <span className='rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-amber-100'>
              {pendingCount} pending
            </span>
          ) : null}
        </div>
      </div>

      <div className='p-4 sm:p-5'>
        <ol className='space-y-0'>
          {timeline.map((item, index) => (
            <PipelineRow key={item.label} item={item} isLast={index === timeline.length - 1} />
          ))}
        </ol>

        <details className='group mt-5 border-t border-white/10 pt-4'>
          <summary className='flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60'>
            <span>All readiness checks and provider snapshots</span>
            <ChevronDown
              size={16}
              className='shrink-0 text-slate-400 transition group-open:rotate-180'
            />
          </summary>
          <div className='mt-3'>
            <PaidOrderRecoveryFulfillmentEvidencePanel
              summary={detail.merchizeFulfillmentOps}
              embedded
            />
          </div>
        </details>
      </div>
    </AdminGlassPanel>
  );
}

function PipelineRow({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  const stateLabel =
    item.state === 'done' ? 'Complete' : item.state === 'failed' ? 'Blocked' : 'Pending';

  return (
    <li className='relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-5 last:pb-0'>
      {!isLast ? (
        <span className='absolute left-[13px] top-7 h-[calc(100%-14px)] w-px bg-white/10' />
      ) : null}
      <span
        className={cn(
          'relative z-10 mt-0.5 grid h-7 w-7 place-items-center rounded-full border',
          item.state === 'done' && 'border-emerald-300/30 bg-emerald-300/15 text-emerald-100',
          item.state === 'failed' && 'border-rose-300/30 bg-rose-300/15 text-rose-100',
          item.state === 'pending' && 'border-amber-300/30 bg-amber-300/15 text-amber-100',
        )}
      >
        {item.state === 'done' ? (
          <CheckCircle2 size={15} />
        ) : item.state === 'failed' ? (
          <AlertTriangle size={14} />
        ) : (
          <Clock3 size={14} />
        )}
      </span>
      <div className='flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
        <div>
          <p className='text-sm font-medium leading-6 text-slate-100'>{item.label}</p>
          <p
            className={cn(
              'text-xs font-medium',
              item.state === 'done' && 'text-emerald-200',
              item.state === 'failed' && 'text-rose-200',
              item.state === 'pending' && 'text-amber-200',
            )}
          >
            {stateLabel}
          </p>
        </div>
        <time className='shrink-0 text-xs leading-6 text-slate-400'>{item.time}</time>
      </div>
    </li>
  );
}

function EvidenceValue({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null;
}) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.03] p-3'>
      <dt className='flex items-center gap-2 text-xs font-medium text-slate-400'>
        <Icon size={14} />
        {label}
      </dt>
      <dd className='mt-2 flex min-w-0 items-center justify-between gap-2'>
        <span className='min-w-0 break-all font-mono text-xs leading-5 text-slate-100'>
          {value ?? 'Not recorded'}
        </span>
        {value ? <AdminCopyValueButton label={label} value={value} /> : null}
      </dd>
    </div>
  );
}

function toReadinessCheck(
  label: string,
  value: string | null,
  readyValues: string[],
  category: string,
): ReadinessCheck {
  const normalized = value?.toLowerCase() ?? 'not_checked';

  if (readyValues.includes(normalized)) {
    return { label, state: 'ready', value: normalized, category };
  }

  if (
    ['blocked', 'failed', 'invalid', 'rejected', 'unavailable'].some((token) =>
      normalized.includes(token),
    )
  ) {
    return { label, state: 'blocked', value: normalized, category };
  }

  return { label, state: 'pending', value: normalized, category };
}

function getRecommendedAction(
  recovery: PaidOrderRecoveryRow,
  detail: PaidOrderRecoveryDetail,
  unresolved: ReadinessCheck[],
) {
  if (recovery.status === 'completed') {
    return 'No recovery action is required. Review the audit trail and close the case.';
  }

  if (detail.needsProviderDetailSync) {
    return 'Refresh Merchize state before retrying the fulfillment handoff.';
  }

  const nonBypassable = unresolved.filter((check) => !check.bypassable);

  if (nonBypassable.length) {
    return `Refresh Merchize state, then resolve ${formatList(
      nonBypassable.map((check) => check.label.toLowerCase()),
    )}.`;
  }

  if (detail.requiresManualRelease) {
    return 'Non-bypassable readiness checks are clear. A master admin can now review the seven-day age override.';
  }

  if (recovery.status === 'recovery') {
    return 'Resume post-payment processing from the durable ledger checkpoint.';
  }

  return 'Refresh Merchize state, then retry the fulfillment handoff if the blocker remains.';
}

function humanize(value: string) {
  return value
    .replace(/[_:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatList(values: string[]) {
  if (values.length <= 1) return values[0] ?? 'the remaining checks';
  if (values.length === 2) return values.join(' and ');
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}
