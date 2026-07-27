import { Clock3, MapPin, Package, UserRound } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import AdminCopyValueButton from './AdminCopyValueButton';
import AdminGlassPanel from './AdminGlassPanel';
import PaidOrderRecoveryAddressOverrideForm from './PaidOrderRecoveryAddressOverrideForm';
import PaidOrderRecoveryRawLedgerDialog from './PaidOrderRecoveryRawLedgerDialog';
import type {
  PaidOrderRecoveryActivityItem,
  PaidOrderRecoveryAddress,
  PaidOrderRecoveryDetail,
  PaidOrderRecoveryReference,
} from './adminShopDashboardTypes';
import type { ShopOpsDataTargetView } from '@/lib/prisma/shop/shopOpsDataTarget';

export function PaidOrderRecoveryPrimaryContextSections({
  detail,
  orderToken,
  shopOpsDataTarget,
}: {
  detail: PaidOrderRecoveryDetail;
  orderToken: string;
  shopOpsDataTarget: ShopOpsDataTargetView;
}) {
  return (
    <div className='space-y-4'>
      <OrderContextPanel detail={detail} />
      <DeliveryContextPanel
        detail={detail}
        orderToken={orderToken}
        shopOpsDataTarget={shopOpsDataTarget}
      />
    </div>
  );
}

export function PaidOrderRecoverySecondaryContextSections({
  detail,
}: {
  detail: PaidOrderRecoveryDetail;
}) {
  return (
    <div className='space-y-4'>
      <ReferencePanel detail={detail} />
    </div>
  );
}

export function PaidOrderRecoveryActivitySection({ detail }: { detail: PaidOrderRecoveryDetail }) {
  return <ActivityPanel activity={detail.activity} />;
}

function OrderContextPanel({ detail }: { detail: PaidOrderRecoveryDetail }) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='border-b border-white/10 px-4 py-4 sm:px-5'>
        <div className='min-w-0'>
          <h3 className='text-base font-semibold text-white'>Order & customer</h3>
          <p className='mt-1 text-sm text-slate-400'>Who placed the order and what they bought.</p>
        </div>
      </div>

      <div className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-5'>
        <div className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3'>
          <MiniInfo
            icon={UserRound}
            label='Customer'
            value={detail.customerName || '—'}
            subvalue={detail.customerEmail}
          />
          <MiniInfo icon={Clock3} label='Created' value={detail.createdAt} />
          <MiniInfo icon={Clock3} label='Last updated' value={detail.updatedAt} />
        </div>

        <div className='border-t border-white/10 pt-4'>
          <div className='mb-3 flex items-center justify-between gap-3'>
            <div>
              <p className='text-sm font-medium text-white'>Items</p>
              <p className='mt-1 text-sm text-slate-400'>
                {detail.items.length} line item{detail.items.length === 1 ? '' : 's'} in this paid
                order.
              </p>
            </div>
          </div>

          <div className='space-y-3'>
            {detail.items.length ? (
              detail.items.map((item) => (
                <div
                  key={item.id}
                  className='grid min-w-0 grid-cols-[56px_minmax(0,1fr)] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 sm:flex'
                >
                  <div className='relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-slate-900'>
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        className='object-cover'
                        sizes='56px'
                      />
                    ) : (
                      <div className='grid h-full w-full place-items-center text-slate-600'>
                        <Package size={18} />
                      </div>
                    )}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium text-slate-100'>{item.title}</p>
                    <p className='mt-1 break-words text-sm text-slate-400'>{item.variant}</p>
                  </div>
                  <div className='col-start-2 flex items-center justify-between gap-3 text-left sm:block sm:shrink-0 sm:text-right'>
                    <p className='text-sm font-medium text-slate-100'>{item.unitPrice}</p>
                    <p className='text-sm text-slate-400 sm:mt-1'>Qty {item.quantity}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className='rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-slate-400'>
                No cart snapshot was stored for this order.
              </p>
            )}
          </div>
        </div>
      </div>
    </AdminGlassPanel>
  );
}

function DeliveryContextPanel({
  detail,
  orderToken,
  shopOpsDataTarget,
}: {
  detail: PaidOrderRecoveryDetail;
  orderToken: string;
  shopOpsDataTarget: ShopOpsDataTargetView;
}) {
  const provider = detail.merchizeFulfillmentOps;
  const readbackStatus = provider?.addressReadbackStatus;
  const addressBadge =
    readbackStatus === 'matched'
      ? { label: 'Provider address matches', tone: 'emerald' }
      : readbackStatus === 'mismatch'
        ? { label: 'Provider address differs', tone: 'rose' }
        : detail.addressCorrectionProviderApplied
          ? { label: 'Verified when saved', tone: 'amber' }
          : { label: 'Local correction saved', tone: 'amber' };
  const validationLabel = getAddressValidationLabel(
    provider?.addressValidationStatus,
    provider?.addressMarkedValid ?? false,
  );

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5'>
        <div>
          <h3 className='text-base font-semibold text-white'>Fulfillment address</h3>
          <p className='mt-1 text-sm text-slate-400'>
            Original checkout address and audited fulfillment correction state.
          </p>
        </div>
        {detail.hasAddressOverride ? (
          <span
            className={cn(
              'rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]',
              addressBadge.tone === 'emerald'
                ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'
                : addressBadge.tone === 'rose'
                  ? 'border-rose-300/25 bg-rose-300/10 text-rose-200'
                  : 'border-amber-300/20 bg-amber-300/10 text-amber-200',
            )}
          >
            {addressBadge.label}
          </span>
        ) : null}
      </div>

      <div className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-5'>
        <div className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2'>
          <AddressBlock
            label={
              detail.hasAddressOverride
                ? 'Corrected fulfillment address'
                : 'Original fulfillment address'
            }
            address={detail.activeAddress}
            emphasized
          />

          {detail.hasAddressOverride ? (
            <AddressBlock label='Original checkout address' address={detail.originalAddress} />
          ) : (
            <PaidOrderRecoveryAddressOverrideForm
              orderToken={orderToken}
              initialAddress={detail.activeAddress ?? detail.originalAddress}
              hasExistingOverride={detail.hasAddressOverride}
              shopOpsDataTarget={shopOpsDataTarget}
            />
          )}
        </div>

        {provider ? (
          <div className='grid min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-2'>
            <div>
              <p className='text-xs uppercase tracking-[0.08em] text-slate-500'>
                Provider read-back
              </p>
              <p className='mt-1 text-sm font-medium text-slate-100'>
                {getAddressReadbackLabel(readbackStatus, detail.addressCorrectionProviderApplied)}
              </p>
              <p className='mt-1 text-xs leading-5 text-slate-400'>
                {provider.lastAddressCheckAt
                  ? `Last address check ${provider.lastAddressCheckAt}`
                  : 'No provider address check is recorded.'}
              </p>
              {provider.addressReadbackMismatchFields.length ? (
                <p className='mt-1 text-xs leading-5 text-rose-200'>
                  Different fields: {provider.addressReadbackMismatchFields.join(', ')}
                </p>
              ) : null}
            </div>
            <div>
              <p className='text-xs uppercase tracking-[0.08em] text-slate-500'>
                Merchize validation
              </p>
              <p className='mt-1 text-sm font-medium text-slate-100'>{validationLabel}</p>
              {provider.addressValidationStatus ? (
                <p className='mt-1 text-xs leading-5 text-slate-400'>
                  Provider status:{' '}
                  <code className='text-slate-300'>{provider.addressValidationStatus}</code>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {detail.hasAddressOverride ? (
          <div className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.72fr)]'>
            <div className='rounded-lg border border-amber-300/14 bg-amber-300/[0.04] p-3'>
              <p className='text-sm font-medium text-amber-100'>Override note</p>
              <p className='mt-2 text-sm text-slate-200'>
                {detail.addressOverrideReason ?? 'No reason recorded.'}
              </p>
              <p className='mt-2 text-sm text-slate-400'>
                {detail.addressOverriddenBy ?? 'admin'} ·{' '}
                {detail.addressOverriddenAt ?? 'time unavailable'}
              </p>
            </div>
            <PaidOrderRecoveryAddressOverrideForm
              orderToken={orderToken}
              initialAddress={detail.activeAddress ?? detail.originalAddress}
              hasExistingOverride={detail.hasAddressOverride}
              shopOpsDataTarget={shopOpsDataTarget}
            />
          </div>
        ) : null}
      </div>
    </AdminGlassPanel>
  );
}

function getAddressReadbackLabel(status: string | null | undefined, verifiedWhenSaved: boolean) {
  if (status === 'matched') return 'Matches the effective ledger address';
  if (status === 'mismatch') return 'Does not match the effective ledger address';
  if (verifiedWhenSaved)
    return 'Matched when the correction was saved; refresh for a current check';
  return 'Not checked against the effective ledger address';
}

function getAddressValidationLabel(status: string | null | undefined, markedValid: boolean) {
  if (markedValid) return 'Manually confirmed in Merchize';
  if (status === 'valid') return 'US address valid';
  if (status === 'other' || status === 'others') {
    return 'Non-US address; US validation does not apply';
  }
  if (status === 'street_undefined') return 'Street could not be validated';
  if (status === 'zipcode_undefined') return 'Postal code could not be validated';
  if (status === 'missing_secondary') return 'Secondary address information may be missing';
  if (status === 'inactive') return 'Address reported inactive';
  if (status === 'vacant') return 'Address reported vacant';
  if (status === 'pending') return 'Validation pending';
  if (status === 'invalid') return 'Address invalid';
  return status ? 'Provider review required' : 'Validation status unavailable';
}

function ReferencePanel({ detail }: { detail: PaidOrderRecoveryDetail }) {
  const groups = groupReferences(detail.references);

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex flex-col items-start gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
        <div className='min-w-0'>
          <h3 className='text-base font-semibold text-white'>Cross-system references</h3>
          <p className='mt-1 text-sm text-slate-400'>
            Grouped identifiers for investigation and escalation.
          </p>
        </div>
        <PaidOrderRecoveryRawLedgerDialog rawDebug={detail.rawDebug} />
      </div>

      <div className='space-y-5 p-4 sm:p-5'>
        {groups.map((group) => (
          <section key={group.label}>
            <h4 className='mb-2 text-sm font-semibold text-slate-200'>{group.label}</h4>
            <div className='overflow-hidden rounded-lg border border-white/10 bg-black/10'>
              {group.references.map((reference) => (
                <ReferenceRow key={reference.label} reference={reference} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminGlassPanel>
  );
}

function ActivityPanel({ activity }: { activity: PaidOrderRecoveryActivityItem[] }) {
  const operatorActivity = activity.filter((item) => item.kind === 'operator');
  const systemActivity = activity.filter((item) => item.kind === 'system');

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='border-b border-white/10 px-4 py-4 sm:px-5'>
        <h3 className='text-base font-semibold text-white'>Changes & audit</h3>
        <p className='mt-1 text-sm text-slate-400'>
          Operator mutations are separated from automated processing events. Times use the system
          timezone.
        </p>
      </div>

      <div className='space-y-5 px-4 py-4 sm:px-5'>
        <section>
          <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
            <h4 className='text-sm font-semibold text-slate-100'>Operator changes</h4>
            <span className='rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-0.5 text-xs text-cyan-100'>
              {operatorActivity.length}
            </span>
          </div>
          {operatorActivity.length ? (
            <ActivityList activity={operatorActivity} />
          ) : (
            <p className='rounded-lg border border-white/10 bg-white/[0.025] px-3 py-3 text-sm text-slate-400'>
              No operator changes have been recorded.
            </p>
          )}
        </section>

        <section className='rounded-lg border border-white/10 bg-white/[0.02] p-3'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h4 className='text-sm font-semibold text-slate-100'>Automated system history</h4>
              <p className='mt-0.5 text-sm text-slate-400'>
                Webhooks, saves, recovery attempts, and fulfillment events
              </p>
            </div>
            <span className='rounded-full border border-white/10 px-2 py-0.5 text-xs text-slate-300'>
              {systemActivity.length}
            </span>
          </div>

          {systemActivity.length ? (
            <div className='mt-3 border-t border-white/10 pt-3'>
              <ActivityList activity={systemActivity} />
            </div>
          ) : (
            <p className='mt-3 text-sm text-slate-400'>
              No automated processing events have been recorded.
            </p>
          )}
        </section>
      </div>
    </AdminGlassPanel>
  );
}

function ActivityList({ activity }: { activity: PaidOrderRecoveryActivityItem[] }) {
  return (
    <div>
      {activity.map((item, index) => (
        <div
          key={`${item.label}-${item.time}`}
          className='relative grid grid-cols-[16px_minmax(0,1fr)] gap-3 pb-5 last:pb-0'
        >
          {index < activity.length - 1 ? (
            <span className='absolute left-[7px] top-4 h-[calc(100%-16px)] w-px bg-white/10' />
          ) : null}
          <span
            className={cn(
              'mt-1.5 h-3.5 w-3.5 rounded-full border',
              item.tone === 'emerald' && 'border-emerald-300/50 bg-emerald-300/25',
              item.tone === 'amber' && 'border-amber-300/50 bg-amber-300/25',
              item.tone === 'rose' && 'border-rose-300/50 bg-rose-300/25',
              item.tone === 'cyan' && 'border-cyan-300/50 bg-cyan-300/25',
              item.tone === 'slate' && 'border-slate-300/40 bg-slate-300/15',
            )}
          />
          <div>
            <div className='flex flex-wrap items-start justify-between gap-x-3 gap-y-1'>
              <p className='text-sm font-medium text-slate-100'>{item.label}</p>
              <p className='text-sm text-slate-400'>{item.time}</p>
            </div>
            <p className='mt-1 text-sm leading-5 text-slate-300'>{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddressBlock({
  label,
  address,
  emphasized = false,
}: {
  label: string;
  address: PaidOrderRecoveryAddress | null;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3',
        emphasized ? 'border-cyan-300/18 bg-cyan-300/[0.045]' : 'border-white/10 bg-white/[0.025]',
      )}
    >
      <div className='flex items-center gap-2 text-sm font-medium text-slate-300'>
        <MapPin size={13} />
        {label}
      </div>
      {address ? (
        <div className='mt-3 space-y-1 text-sm leading-5 text-slate-200'>
          <p>{address.line1}</p>
          {address.line2 ? <p>{address.line2}</p> : null}
          <p>{[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}</p>
          <p>{address.country}</p>
        </div>
      ) : (
        <p className='mt-3 text-sm text-slate-400'>No address recorded.</p>
      )}
    </div>
  );
}

function ReferenceRow({ reference }: { reference: PaidOrderRecoveryReference }) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)] gap-1.5 border-b border-white/10 px-3 py-3 text-sm last:border-b-0 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:gap-3'>
      <p className='text-slate-400'>{reference.label}</p>
      <div className='flex min-w-0 items-start justify-start gap-2 text-left sm:justify-end sm:text-right'>
        <p className='min-w-0 break-all font-mono text-xs leading-5 text-slate-200'>
          {reference.value ?? '—'}
        </p>
        {reference.value ? (
          <AdminCopyValueButton label={reference.label} value={reference.value} />
        ) : null}
      </div>
    </div>
  );
}

function groupReferences(references: PaidOrderRecoveryReference[]) {
  const groups = [
    { label: 'Payment & webhooks', references: [] as PaidOrderRecoveryReference[] },
    { label: 'Post-payment processing', references: [] as PaidOrderRecoveryReference[] },
    { label: 'Merchize fulfillment', references: [] as PaidOrderRecoveryReference[] },
    { label: 'Checkout & identity', references: [] as PaidOrderRecoveryReference[] },
  ];

  for (const reference of references) {
    const label = reference.label.toLowerCase();
    const group = label.startsWith('merchize')
      ? groups[2]
      : label.includes('paypal') || label.includes('webhook')
        ? groups[0]
        : label.includes('processing') || label.includes('django') || label.includes('scanner')
          ? groups[1]
          : groups[3];

    group.references.push(reference);
  }

  return groups.filter((group) => group.references.length > 0);
}

function MiniInfo({
  icon: Icon,
  label,
  value,
  subvalue,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  subvalue?: string;
}) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.03] p-3'>
      <div className='flex items-center gap-2 text-sm font-medium text-slate-300'>
        <Icon size={13} />
        {label}
      </div>
      <p className='mt-3 break-words text-sm font-medium text-slate-100'>{value}</p>
      {subvalue ? <p className='mt-1 break-all text-sm text-slate-400'>{subvalue}</p> : null}
    </div>
  );
}
