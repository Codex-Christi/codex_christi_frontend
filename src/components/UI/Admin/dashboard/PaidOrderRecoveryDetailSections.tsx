import {
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  Package,
  ReceiptText,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import AdminGlassPanel from './AdminGlassPanel';
import PaidOrderRecoveryAddressOverrideForm from './PaidOrderRecoveryAddressOverrideForm';
import PaidOrderRecoveryRawLedgerDialog from './PaidOrderRecoveryRawLedgerDialog';
import type {
  PaidOrderRecoveryActivityItem,
  PaidOrderRecoveryAddress,
  PaidOrderRecoveryDetail,
  PaidOrderRecoveryReference,
} from './adminShopDashboardTypes';

export function PaidOrderRecoveryContextSections({
  detail,
  orderToken,
}: {
  detail: PaidOrderRecoveryDetail;
  orderToken: string;
}) {
  return (
    <div className='grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]'>
      <div className='space-y-4'>
        <OrderContextPanel detail={detail} />
        <DeliveryContextPanel detail={detail} orderToken={orderToken} />
      </div>

      <div className='space-y-4'>
        <ReferencePanel detail={detail} />
        <ActivityPanel activity={detail.activity} />
      </div>
    </div>
  );
}

function OrderContextPanel({ detail }: { detail: PaidOrderRecoveryDetail }) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5'>
        <div>
          <h3 className='text-sm font-semibold text-white'>Order Context</h3>
          <p className='mt-1 text-xs text-slate-500'>Customer, items, and receipt context.</p>
        </div>
        {detail.receiptLink ? (
          <a
            href={detail.receiptLink}
            target='_blank'
            rel='noreferrer'
            className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/8 px-3 py-2 text-xs font-medium text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/12'
          >
            <ReceiptText size={14} />
            Receipt
            <ExternalLink size={12} />
          </a>
        ) : null}
      </div>

      <div className='grid gap-4 p-4 sm:p-5'>
        <div className='grid gap-3 sm:grid-cols-3'>
          <MiniInfo icon={UserRound} label='Customer' value={detail.customerName || '—'} subvalue={detail.customerEmail} />
          <MiniInfo icon={Clock3} label='Created' value={detail.createdAt} />
          <MiniInfo icon={Clock3} label='Last updated' value={detail.updatedAt} />
        </div>

        <div className='border-t border-white/10 pt-4'>
          <div className='mb-3 flex items-center justify-between gap-3'>
            <div>
              <p className='text-sm font-medium text-white'>Items</p>
              <p className='mt-1 text-xs text-slate-500'>
                {detail.items.length} line item{detail.items.length === 1 ? '' : 's'} in this paid order.
              </p>
            </div>
          </div>

          <div className='space-y-3'>
            {detail.items.length ? (
              detail.items.map((item) => (
                <div
                  key={item.id}
                  className='flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3'
                >
                  <div className='relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-slate-900'>
                    {item.image ? (
                      <Image src={item.image} alt={item.title} fill className='object-cover' sizes='56px' />
                    ) : (
                      <div className='grid h-full w-full place-items-center text-slate-600'>
                        <Package size={18} />
                      </div>
                    )}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium text-slate-100'>{item.title}</p>
                    <p className='mt-1 truncate text-xs text-slate-500'>{item.variant}</p>
                  </div>
                  <div className='shrink-0 text-right'>
                    <p className='text-sm font-medium text-slate-100'>{item.unitPrice}</p>
                    <p className='mt-1 text-xs text-slate-500'>Qty {item.quantity}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className='rounded-lg border border-white/10 bg-white/[0.03] px-3 py-4 text-sm text-slate-500'>
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
}: {
  detail: PaidOrderRecoveryDetail;
  orderToken: string;
}) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5'>
        <div>
          <h3 className='text-sm font-semibold text-white'>Fulfillment Address</h3>
          <p className='mt-1 text-xs text-slate-500'>Address currently used for the fulfillment retry.</p>
        </div>
        {detail.hasAddressOverride ? (
          <span className='rounded-md border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-amber-200'>
            Override active
          </span>
        ) : null}
      </div>

      <div className='grid gap-4 p-4 sm:p-5'>
        <div className='grid gap-4 md:grid-cols-2'>
          <AddressBlock
            label={detail.hasAddressOverride ? 'Active fulfillment address' : 'Original fulfillment address'}
            address={detail.activeAddress}
            emphasized
          />

          {detail.hasAddressOverride ? (
            <AddressBlock label='Original checkout address' address={detail.originalAddress} />
          ) : (
            <div className='rounded-lg border border-white/10 bg-white/[0.025] p-3'>
              <div className='flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-slate-500'>
                <ShieldAlert size={13} />
                No override saved
              </div>
              <p className='mt-3 text-sm leading-6 text-slate-400'>
                The original checkout address is still the active fulfillment address.
              </p>
            </div>
          )}
        </div>

        {detail.hasAddressOverride ? (
          <div className='rounded-lg border border-amber-300/14 bg-amber-300/[0.04] p-3'>
            <p className='text-xs uppercase tracking-[0.08em] text-amber-200'>Override note</p>
            <p className='mt-2 text-sm text-slate-200'>{detail.addressOverrideReason ?? 'No reason recorded.'}</p>
            <p className='mt-2 text-xs text-slate-500'>
              {detail.addressOverriddenBy ?? 'admin'} · {detail.addressOverriddenAt ?? 'time unavailable'}
            </p>
          </div>
        ) : null}

        <PaidOrderRecoveryAddressOverrideForm
          orderToken={orderToken}
          initialAddress={detail.activeAddress ?? detail.originalAddress}
          hasExistingOverride={detail.hasAddressOverride}
        />
      </div>
    </AdminGlassPanel>
  );
}

function ReferencePanel({ detail }: { detail: PaidOrderRecoveryDetail }) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5'>
        <div>
          <h3 className='text-sm font-semibold text-white'>References</h3>
          <p className='mt-1 text-xs text-slate-500'>Cross-system identifiers for escalation and support.</p>
        </div>
        <PaidOrderRecoveryRawLedgerDialog rawDebug={detail.rawDebug} />
      </div>

      <div className='divide-y divide-white/10'>
        {detail.references.map((reference) => (
          <ReferenceRow key={reference.label} reference={reference} />
        ))}
      </div>
    </AdminGlassPanel>
  );
}

function ActivityPanel({ activity }: { activity: PaidOrderRecoveryActivityItem[] }) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='border-b border-white/10 px-4 py-3 sm:px-5'>
        <h3 className='text-sm font-semibold text-white'>Activity</h3>
        <p className='mt-1 text-xs text-slate-500'>Important order and recovery events.</p>
      </div>

      <div className='space-y-0 px-4 py-4 sm:px-5'>
        {activity.map((item, index) => (
          <div key={`${item.label}-${item.time}`} className='relative grid grid-cols-[16px_minmax(0,1fr)] gap-3 pb-5 last:pb-0'>
            {index < activity.length - 1 ? (
              <span className='absolute left-[7px] top-4 h-[calc(100%-16px)] w-px bg-white/10' />
            ) : null}
            <span
              className={cn(
                'mt-1.5 h-3.5 w-3.5 rounded-full border',
                item.tone === 'emerald' && 'border-emerald-300/40 bg-emerald-300/20',
                item.tone === 'amber' && 'border-amber-300/40 bg-amber-300/20',
                item.tone === 'rose' && 'border-rose-300/40 bg-rose-300/20',
                item.tone === 'cyan' && 'border-cyan-300/40 bg-cyan-300/20',
                item.tone === 'slate' && 'border-slate-300/30 bg-slate-300/12',
              )}
            />
            <div>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='text-sm font-medium text-slate-100'>{item.label}</p>
                <p className='text-xs text-slate-500'>{item.time}</p>
              </div>
              <p className='mt-1 text-xs leading-5 text-slate-500'>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </AdminGlassPanel>
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
        emphasized
          ? 'border-cyan-300/18 bg-cyan-300/[0.045]'
          : 'border-white/10 bg-white/[0.025]',
      )}
    >
      <div className='flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-slate-500'>
        <MapPin size={13} />
        {label}
      </div>
      {address ? (
        <div className='mt-3 space-y-1 text-sm leading-5 text-slate-200'>
          <p>{address.line1}</p>
          {address.line2 ? <p>{address.line2}</p> : null}
          <p>
            {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
          </p>
          <p>{address.country}</p>
        </div>
      ) : (
        <p className='mt-3 text-sm text-slate-500'>No address recorded.</p>
      )}
    </div>
  );
}

function ReferenceRow({ reference }: { reference: PaidOrderRecoveryReference }) {
  return (
    <div className='grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3 px-4 py-3 text-sm sm:px-5'>
      <p className='text-slate-500'>{reference.label}</p>
      <div className='flex min-w-0 items-center justify-end gap-2 text-right'>
        <p className='truncate font-mono text-[11px] text-slate-200'>{reference.value ?? '—'}</p>
        {reference.value ? <Copy size={12} className='shrink-0 text-slate-600' /> : null}
      </div>
    </div>
  );
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
      <div className='flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-slate-500'>
        <Icon size={13} />
        {label}
      </div>
      <p className='mt-3 truncate text-sm font-medium text-slate-100'>{value}</p>
      {subvalue ? <p className='mt-1 truncate text-xs text-slate-500'>{subvalue}</p> : null}
    </div>
  );
}
