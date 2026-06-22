import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Eye, Filter, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminGlassPanel from './AdminGlassPanel';
import { AdminPaidOrderRecoveryStatusBadge } from './AdminStatusBadge';
import type {
  PaidOrderRecoveryFilters,
  PaidOrderRecoveryPagination,
  PaidOrderRecoveryRow,
  PaidOrderRecoveryStatusFilter,
} from './adminShopDashboardTypes';

type PaidOrderRecoveryQueuePanelProps = {
  mobileMode?: 'summary-link' | 'full-list';
  rows?: PaidOrderRecoveryRow[];
  filters?: PaidOrderRecoveryFilters;
  pagination?: PaidOrderRecoveryPagination;
};

const statusFilterOptions: Array<{ value: PaidOrderRecoveryStatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'failed', label: 'Failed' },
  { value: 'attention', label: 'Attention' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'pending', label: 'Pending' },
  { value: 'sync', label: 'Provider sync' },
  { value: 'completed', label: 'Completed' },
];

const pageSizeOptions = [10, 25, 50] as const;

export default function PaidOrderRecoveryQueuePanel({
  mobileMode = 'full-list',
  rows = [],
  filters = { search: '', status: 'all' },
  pagination = {
    currentPage: 1,
    pageSize: rows.length || 25,
    totalRows: rows.length,
    totalPages: 1,
    pageStart: rows.length ? 1 : 0,
    pageEnd: rows.length,
  },
}: PaidOrderRecoveryQueuePanelProps) {
  const failedCount = rows.filter((row) => row.status === 'failed').length;
  const recoveryCount = rows.filter((row) => row.status === 'recovery').length;
  const latestRow = rows[0];
  const showFullControls = mobileMode === 'full-list';
  const previousHref = buildPaidOrderRecoveryHref({
    filters,
    page: Math.max(1, pagination.currentPage - 1),
    pageSize: pagination.pageSize,
  });
  const nextHref = buildPaidOrderRecoveryHref({
    filters,
    page: Math.min(pagination.totalPages, pagination.currentPage + 1),
    pageSize: pagination.pageSize,
  });

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3'>
        <div>
          <h2 className='text-base font-semibold text-white'>Paid Order Recovery Queue</h2>
          <p className='mt-1 text-xs text-slate-500'>
            Live ledger-backed paid order recovery queue.
          </p>
        </div>
        <div
          className={cn(
            'items-center gap-2',
            mobileMode === 'summary-link' ? 'hidden md:flex' : 'flex',
          )}
        >
          <a
            href={
              showFullControls ? '#paid-order-recovery-filters' : '/admin/shop/paid-order-recovery'
            }
            className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
          >
            <Filter size={15} />
            Filters
          </a>
          <Link
            href='/admin/shop/paid-order-recovery'
            aria-label='Reset paid order recovery filters'
            className='grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
          >
            <MoreHorizontal size={16} />
          </Link>
        </div>
      </div>

      {showFullControls ? (
        <form
          id='paid-order-recovery-filters'
          action='/admin/shop/paid-order-recovery'
          className='grid gap-3 border-b border-white/10 bg-slate-950/16 px-4 py-4 md:grid-cols-[minmax(0,1fr)_180px_120px_auto_auto] md:items-end'
        >
          <label className='grid gap-1.5 text-xs text-slate-400'>
            Search
            <input
              name='search'
              defaultValue={filters.search}
              placeholder='Email, token, PayPal ID, Django ID, error...'
              className='h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/10'
            />
          </label>
          <label className='grid gap-1.5 text-xs text-slate-400'>
            Status
            <select
              name='status'
              defaultValue={filters.status}
              className='h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/10'
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className='grid gap-1.5 text-xs text-slate-400'>
            Page size
            <select
              name='pageSize'
              defaultValue={String(pagination.pageSize)}
              className='h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none focus:border-cyan-300/35 focus:ring-2 focus:ring-cyan-300/10'
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type='submit'
            className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-medium text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-300/15'
          >
            <Filter size={15} />
            Apply
          </button>
          <Link
            href='/admin/shop/paid-order-recovery'
            className='inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
          >
            Reset
          </Link>
        </form>
      ) : null}

      {mobileMode === 'summary-link' ? (
        <div className='p-4 md:hidden'>
          <Link
            href='/admin/shop/paid-order-recovery'
            data-testid='admin-mobile-paid-order-recovery-queue-link'
            className='group block rounded-lg border border-cyan-300/18 bg-cyan-300/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-cyan-300/35 hover:bg-cyan-300/[0.08]'
          >
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-sm font-semibold text-white'>Open paid order recovery</p>
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
                <p className='truncate font-medium text-slate-200'>
                  {latestRow?.supportRef ?? '—'}
                </p>
                {latestRow ? <AdminPaidOrderRecoveryStatusBadge status={latestRow.status} /> : null}
              </div>
            </div>
          </Link>
        </div>
      ) : (
        <div className='divide-y divide-white/10 md:hidden'>
          {rows.length ? (
            rows.map((row) => (
              <Link
                href={getPaidOrderRecoveryDetailHref(row)}
                key={row.supportRef}
                aria-label={`Open ${row.supportRef} paid order recovery details`}
                data-testid={`admin-mobile-paid-order-recovery-${row.supportRef}`}
                className='block w-full bg-slate-950/14 px-4 py-4 text-left transition hover:bg-white/[0.04]'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='truncate text-sm font-medium text-white'>{row.customer}</p>
                    <p className='mt-1 text-xs text-slate-500'>{row.supportRef}</p>
                  </div>
                  <AdminPaidOrderRecoveryStatusBadge status={row.status} />
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
                    <p className='text-slate-500'>Source</p>
                    <SourceBadge row={row} />
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
            ))
          ) : (
            <div className='px-4 py-8 text-center text-sm text-slate-500'>
              No paid order recovery rows match these filters.
            </div>
          )}
        </div>
      )}

      <div className='hidden overflow-x-auto [-webkit-overflow-scrolling:touch] md:block'>
        <table className='w-full min-w-[1180px] border-collapse text-left text-sm'>
          <thead className='text-[11px] uppercase tracking-[0.08em] text-slate-400'>
            <tr className='border-b border-white/10'>
              <th className='w-[96px] px-4 py-3 font-medium'>Status</th>
              <th className='w-[220px] px-4 py-3 font-medium'>Customer</th>
              <th className='w-[118px] px-4 py-3 font-medium'>Paid Amount</th>
              <th className='w-[170px] px-4 py-3 font-medium'>Current Step</th>
              <th className='w-[180px] px-4 py-3 font-medium'>Source</th>
              <th className='w-[220px] px-4 py-3 font-medium'>Last Error</th>
              <th className='w-[108px] px-4 py-3 font-medium'>Support Ref</th>
              <th className='w-[78px] px-4 py-3 font-medium'>Updated</th>
              <th className='w-[92px] px-4 py-3 font-medium'>Action</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-white/10'>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.supportRef}
                  className='bg-slate-950/18 text-slate-300 transition hover:bg-cyan-300/[0.035]'
                >
                  <td className='px-4 py-3'>
                    <AdminPaidOrderRecoveryStatusBadge status={row.status} />
                  </td>
                  <td className='px-4 py-3 font-medium text-slate-100'>{row.customer}</td>
                  <td className='px-4 py-3 whitespace-nowrap'>{row.amount}</td>
                  <td className='px-4 py-3'>{row.step}</td>
                  <td className='px-4 py-3'>
                    <SourceBadge row={row} />
                  </td>
                  <td className='px-4 py-3'>{row.error}</td>
                  <td className='px-4 py-3 font-mono text-xs whitespace-nowrap text-cyan-100'>
                    {row.supportRef}
                  </td>
                  <td className='px-4 py-3'>{row.updated}</td>
                  <td className='px-4 py-3'>
                    <Link
                      href={getPaidOrderRecoveryDetailHref(row)}
                      aria-label={`View ${row.supportRef}`}
                      className='inline-flex min-w-[78px] items-center justify-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs font-medium whitespace-nowrap text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/10'
                    >
                      <Eye size={15} />
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className='px-4 py-10 text-center text-sm text-slate-500'>
                  No paid order recovery rows match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className={cn(
          'flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-slate-400',
          mobileMode === 'summary-link' ? 'hidden md:flex' : 'flex',
        )}
      >
        <span>
          Showing {pagination.pageStart ? `${pagination.pageStart} to ${pagination.pageEnd}` : '0'}{' '}
          of {pagination.totalRows} rows
        </span>
        <div className='flex items-center gap-2'>
          <PaginationLink
            href={previousHref}
            disabled={pagination.currentPage <= 1}
            ariaLabel='Previous paid order recovery page'
          >
            <ArrowLeft size={15} />
          </PaginationLink>
          <span className='rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-cyan-100'>
            {pagination.currentPage}
          </span>
          <span>of {pagination.totalPages}</span>
          <PaginationLink
            href={nextHref}
            disabled={pagination.currentPage >= pagination.totalPages}
            ariaLabel='Next paid order recovery page'
          >
            <ArrowRight size={15} />
          </PaginationLink>
        </div>
      </div>
    </AdminGlassPanel>
  );
}

function SourceBadge({ row }: { row: PaidOrderRecoveryRow }) {
  const toneClass = {
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
    cyan: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    rose: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
    slate: 'border-white/10 bg-white/[0.04] text-slate-300',
  }[row.processingSourceTone];

  return (
    <span
      className={cn(
        'mt-1 inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs font-medium',
        toneClass,
      )}
    >
      <span className='truncate'>{row.processingSourceLabel}</span>
    </span>
  );
}

function getPaidOrderRecoveryDetailHref(row: PaidOrderRecoveryRow) {
  return `/admin/shop/paid-order-recovery/${encodeURIComponent(row.orderToken)}`;
}

function PaginationLink({
  href,
  disabled,
  ariaLabel,
  children,
}: {
  href: string;
  disabled: boolean;
  ariaLabel: string;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled='true'
        aria-label={ariaLabel}
        className='grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.02] text-slate-600'
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className='grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100'
    >
      {children}
    </Link>
  );
}

function buildPaidOrderRecoveryHref({
  filters,
  page,
  pageSize,
}: {
  filters: PaidOrderRecoveryFilters;
  page: number;
  pageSize: number;
}) {
  const params = new URLSearchParams();

  if (filters.search) params.set('search', filters.search);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (page > 1) params.set('page', String(page));
  if (pageSize !== 25) params.set('pageSize', String(pageSize));

  const query = params.toString();

  return query ? `/admin/shop/paid-order-recovery?${query}` : '/admin/shop/paid-order-recovery';
}
