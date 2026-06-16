import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Filter,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminGlassPanel from './AdminGlassPanel';
import { AdminOrderRecoveryStatusBadge } from './AdminStatusBadge';
import type { OrderRecoveryRow } from './adminShopDashboardTypes';

type OrderRecoveryQueuePanelProps = {
  mobileMode?: 'summary-link' | 'full-list';
  rows?: OrderRecoveryRow[];
};

export default function OrderRecoveryQueuePanel({
  mobileMode = 'full-list',
  rows = [],
}: OrderRecoveryQueuePanelProps) {
  const failedCount = rows.filter((row) => row.status === 'failed').length;
  const recoveryCount = rows.filter((row) => row.status === 'recovery').length;
  const latestRow = rows[0];

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3'>
        <div>
          <h2 className='text-base font-semibold text-white'>Order Recovery Queue</h2>
          <p className='mt-1 text-xs text-slate-500'>Live ledger-backed paid order recovery queue.</p>
        </div>
        <div className={cn('items-center gap-2', mobileMode === 'summary-link' ? 'hidden md:flex' : 'flex')}>
          <button className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200'>
            <Filter size={15} />
            Filters
          </button>
          <button
            type='button'
            aria-label='More order recovery actions'
            className='grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200'
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {mobileMode === 'summary-link' ? (
        <div className='p-4 md:hidden'>
          <Link
            href='/admin/shop/order-recovery'
            data-testid='admin-mobile-order-recovery-queue-link'
            className='group block rounded-lg border border-cyan-300/18 bg-cyan-300/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.08]'
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-sm font-semibold text-white'>Open order recovery</p>
                <p className='mt-1 max-w-[18rem] text-xs leading-5 text-slate-400'>
                  Review paid, paused, failed, and provider-specific recovery rows.
                </p>
              </div>
              <span className='grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5'>
                <ArrowUpRight size={17} />
              </span>
            </div>

            <div className='mt-4 grid grid-cols-3 gap-2 text-xs'>
              <div className='rounded-md border border-white/10 bg-white/[0.035] p-2'>
                <p className='text-lg font-semibold text-white'>{rows.length}</p>
                <p className='mt-0.5 text-slate-500'>Rows</p>
              </div>
              <div className='rounded-md border border-rose-300/15 bg-rose-400/[0.06] p-2'>
                <p className='text-lg font-semibold text-rose-100'>{failedCount}</p>
                <p className='mt-0.5 text-slate-500'>Failed</p>
              </div>
              <div className='rounded-md border border-amber-300/15 bg-amber-400/[0.06] p-2'>
                <p className='text-lg font-semibold text-amber-100'>{recoveryCount}</p>
                <p className='mt-0.5 text-slate-500'>Recovery</p>
              </div>
            </div>

            <div className='mt-4 rounded-md border border-white/10 bg-slate-950/28 p-3 text-xs'>
              <p className='text-slate-500'>Latest</p>
              <div className='mt-2 flex items-center justify-between gap-3'>
                <p className='truncate font-medium text-slate-200'>{latestRow?.supportRef ?? '—'}</p>
                {latestRow ? <AdminOrderRecoveryStatusBadge status={latestRow.status} /> : null}
              </div>
            </div>
          </Link>
        </div>
      ) : (
        <div className='divide-y divide-white/10 md:hidden'>
          {rows.map((row) => (
            <Link
              href={getOrderRecoveryDetailHref(row)}
              key={row.supportRef}
              aria-label={`Open ${row.supportRef} order recovery details`}
              data-testid={`admin-mobile-order-recovery-${row.supportRef}`}
              className='block w-full bg-slate-950/14 px-4 py-4 text-left transition hover:bg-white/[0.04]'
            >
              <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium text-white'>{row.customer}</p>
                  <p className='mt-1 text-xs text-slate-500'>{row.supportRef}</p>
                </div>
                <AdminOrderRecoveryStatusBadge status={row.status} />
              </div>
              <div className='mt-4 grid grid-cols-2 gap-3 text-xs'>
                <div>
                  <p className='text-slate-500'>Amount</p>
                  <p className='mt-1 font-medium text-slate-200'>{row.amount}</p>
                </div>
                <div>
                  <p className='text-slate-500'>Updated</p>
                  <p className='mt-1 font-medium text-slate-200'>{row.updated}</p>
                </div>
                <div className='col-span-2'>
                  <p className='text-slate-500'>Step</p>
                  <p className='mt-1 font-medium text-slate-200'>{row.step}</p>
                </div>
                <div className='col-span-2'>
                  <p className='text-slate-500'>Last Error</p>
                  <p className='mt-1 font-medium text-slate-200'>{row.error}</p>
                </div>
              </div>
              <span className='mt-4 inline-flex items-center gap-2 text-xs font-medium text-cyan-100'>
                View details
                <Eye size={14} />
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className='hidden overflow-x-auto [-webkit-overflow-scrolling:touch] md:block'>
        <table className='w-full min-w-[1080px] border-collapse text-left text-sm'>
          <thead className='text-[11px] uppercase tracking-[0.08em] text-slate-400'>
            <tr className='border-b border-white/10'>
              <th className='w-[96px] px-4 py-3 font-medium'>Status</th>
              <th className='w-[220px] px-4 py-3 font-medium'>Customer</th>
              <th className='w-[118px] px-4 py-3 font-medium'>Paid Amount</th>
              <th className='w-[170px] px-4 py-3 font-medium'>Current Step</th>
              <th className='w-[220px] px-4 py-3 font-medium'>Last Error</th>
              <th className='w-[108px] px-4 py-3 font-medium'>Support Ref</th>
              <th className='w-[78px] px-4 py-3 font-medium'>Updated</th>
              <th className='w-[92px] px-4 py-3 font-medium'>Action</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-white/10'>
            {rows.map((row) => (
              <tr key={row.supportRef} className='bg-slate-950/18 text-slate-300 transition hover:bg-cyan-300/[0.035]'>
                <td className='px-4 py-3'>
                  <AdminOrderRecoveryStatusBadge status={row.status} />
                </td>
                <td className='px-4 py-3 font-medium text-slate-100'>{row.customer}</td>
                <td className='px-4 py-3 whitespace-nowrap'>{row.amount}</td>
                <td className='px-4 py-3'>{row.step}</td>
                <td className='px-4 py-3'>{row.error}</td>
                <td className='px-4 py-3 font-mono text-xs whitespace-nowrap text-cyan-100'>{row.supportRef}</td>
                <td className='px-4 py-3'>{row.updated}</td>
                <td className='px-4 py-3'>
                  <Link
                    href={getOrderRecoveryDetailHref(row)}
                    aria-label={`View ${row.supportRef}`}
                    className='inline-flex min-w-[78px] items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs font-medium whitespace-nowrap text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/10'
                  >
                    <Eye size={15} />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className={cn(
          'flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-slate-400',
          mobileMode === 'summary-link' ? 'hidden md:flex' : 'flex',
        )}
      >
        <span>Showing {rows.length ? `1 to ${rows.length}` : '0'} of {rows.length} rows</span>
        <div className='flex items-center gap-2'>
          <ArrowLeft size={15} />
          <span className='rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-cyan-100'>1</span>
          <span>2</span>
          <span>3</span>
          <ArrowRight size={15} />
        </div>
      </div>
    </AdminGlassPanel>
  );
}

function getOrderRecoveryDetailHref(row: OrderRecoveryRow) {
  return `/admin/shop/order-recovery/${encodeURIComponent(row.orderToken)}`;
}
