'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import {
  runPayPalPaymentReconciliationAction,
  type PayPalPaymentReconciliationActionState,
} from '@/app/admin/(dashboard)/shop/paypal-reconciliation/actions';
import type {
  PayPalPaymentReconciliationDashboard,
  PayPalPaymentReconciliationRow,
} from '@/lib/paypal/txLedger/paymentReconciliation';
import { cn } from '@/lib/utils';
import AdminGlassPanel from './dashboard/AdminGlassPanel';

type AdminShopPaymentReconciliationClientProps = {
  dashboard: PayPalPaymentReconciliationDashboard;
};

const initialState: PayPalPaymentReconciliationActionState = {
  error: null,
  success: null,
  result: null,
};

export default function AdminShopPaymentReconciliationClient({
  dashboard,
}: AdminShopPaymentReconciliationClientProps) {
  const [state, formAction, pending] = useActionState(
    runPayPalPaymentReconciliationAction,
    initialState,
  );

  return (
    <div className='px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
      <section className='mx-auto max-w-[1600px] space-y-4'>
        <Link
          href='/admin/shop'
          className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
        >
          <ArrowLeft size={16} />
          Shop dashboard
        </Link>

        <div className='grid gap-3 md:grid-cols-4'>
          <MetricCard label='Attention Rows' value={`${dashboard.total}`} tone='cyan' />
          <MetricCard label='Critical' value={`${dashboard.critical}`} tone='rose' />
          <MetricCard label='Warning' value={`${dashboard.warning}`} tone='amber' />
          <MetricCard
            label='Scanner'
            value={dashboard.enabled ? 'Enabled' : 'Disabled'}
            tone={dashboard.enabled ? 'emerald' : 'amber'}
          />
        </div>

        <AdminGlassPanel className='p-4 sm:p-5'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
            <div className='min-w-0'>
              <div className='inline-flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-100'>
                <ShieldAlert size={14} />
                Payment Reconciliation
              </div>
              <h2 className='mt-3 text-base font-semibold text-white'>PayPal truth scanner</h2>
              <p className='mt-1 max-w-3xl text-sm leading-6 text-slate-400'>
                Checks stale authorization/capture rows against PayPal, hydrates completed captures,
                resumes server-side fulfillment, and alerts payment recipients when manual review is
                still required.
              </p>
            </div>

            <form action={formAction} className='flex flex-col gap-2 sm:flex-row'>
              <button
                type='submit'
                name='dryRun'
                value='true'
                disabled={pending}
                className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 disabled:cursor-not-allowed disabled:opacity-60'
              >
                {pending ? <Loader2 size={16} className='animate-spin' /> : <RefreshCw size={16} />}
                Dry Run
              </button>
              <button
                type='submit'
                disabled={pending}
                className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60'
              >
                {pending ? (
                  <Loader2 size={16} className='animate-spin' />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                Run Batch
              </button>
            </form>
          </div>

          <div className='mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-3'>
            <span className='rounded-md border border-white/10 bg-white/[0.03] px-3 py-2'>
              Min age: {dashboard.minAgeMinutes} minutes
            </span>
            <span className='rounded-md border border-white/10 bg-white/[0.03] px-3 py-2'>
              Batch size: {dashboard.batchSize}
            </span>
            <span className='rounded-md border border-white/10 bg-white/[0.03] px-3 py-2'>
              Generated: {formatShortDate(dashboard.generatedAt)}
            </span>
          </div>

          {state.error ? (
            <p className='mt-4 rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm leading-6 text-rose-100'>
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className='mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-sm leading-6 text-emerald-100'>
              {state.success}
            </p>
          ) : null}

          {state.result?.results.length ? (
            <div className='mt-4 rounded-lg border border-white/10 bg-slate-950/28 p-3'>
              <h3 className='text-sm font-semibold text-white'>Latest Run</h3>
              <div className='mt-3 grid gap-2 md:grid-cols-2'>
                {state.result.results.map((result) => (
                  <div
                    key={`${result.orderToken}-${result.action}`}
                    className='rounded-md border border-white/10 bg-white/[0.03] p-3 text-xs'
                  >
                    <div className='flex items-center justify-between gap-3'>
                      <span className='font-mono text-cyan-100'>
                        {result.orderToken.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          'rounded-md border px-2 py-0.5',
                          result.ok
                            ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                            : 'border-rose-300/20 bg-rose-300/10 text-rose-100',
                        )}
                      >
                        {result.ok ? 'ok' : 'attention'}
                      </span>
                    </div>
                    <p className='mt-2 text-slate-300'>{result.message}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </AdminGlassPanel>

        <PaymentReconciliationTable rows={dashboard.rows} />
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'cyan' | 'rose' | 'amber' | 'emerald';
}) {
  const toneClass = {
    cyan: 'text-cyan-100',
    rose: 'text-rose-100',
    amber: 'text-amber-100',
    emerald: 'text-emerald-100',
  }[tone];

  return (
    <AdminGlassPanel className='p-4'>
      <p className='text-xs uppercase tracking-[0.12em] text-slate-500'>{label}</p>
      <p className={cn('mt-2 text-2xl font-semibold tracking-normal', toneClass)}>{value}</p>
    </AdminGlassPanel>
  );
}

function PaymentReconciliationTable({ rows }: { rows: PayPalPaymentReconciliationRow[] }) {
  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3'>
        <div>
          <h2 className='text-base font-semibold text-white'>Payment Attention Inventory</h2>
          <p className='mt-1 text-xs text-slate-500'>
            Local rows that need PayPal authorization or capture verification.
          </p>
        </div>
      </div>

      {rows.length ? (
        <>
          <div className='divide-y divide-white/10 md:hidden'>
            {rows.map((row) => (
              <MobilePaymentRow key={row.orderToken} row={row} />
            ))}
          </div>

          <div className='hidden overflow-x-auto [-webkit-overflow-scrolling:touch] md:block'>
            <table className='w-full min-w-[1180px] border-collapse text-left text-sm'>
              <thead className='text-[11px] uppercase tracking-[0.08em] text-slate-400'>
                <tr className='border-b border-white/10'>
                  <th className='w-[112px] px-4 py-3 font-medium'>Risk</th>
                  <th className='w-[210px] px-4 py-3 font-medium'>Customer</th>
                  <th className='w-[110px] px-4 py-3 font-medium'>Amount</th>
                  <th className='w-[136px] px-4 py-3 font-medium'>Ledger</th>
                  <th className='w-[170px] px-4 py-3 font-medium'>PayPal Ref</th>
                  <th className='w-[260px] px-4 py-3 font-medium'>Reason</th>
                  <th className='w-[250px] px-4 py-3 font-medium'>Next Action</th>
                  <th className='w-[90px] px-4 py-3 font-medium'>Updated</th>
                  <th className='w-[92px] px-4 py-3 font-medium'>Open</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-white/10'>
                {rows.map((row) => (
                  <tr
                    key={row.orderToken}
                    className='bg-slate-950/18 text-slate-300 transition hover:bg-cyan-300/[0.035]'
                  >
                    <td className='px-4 py-3'>
                      <RiskBadge risk={row.risk} />
                    </td>
                    <td className='px-4 py-3 font-medium text-slate-100'>{row.customer}</td>
                    <td className='whitespace-nowrap px-4 py-3'>{row.amount}</td>
                    <td className='px-4 py-3'>
                      <span className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs'>
                        {row.status}
                      </span>
                    </td>
                    <td className='px-4 py-3 font-mono text-xs text-cyan-100'>
                      {row.captureId ?? row.paypalAuthorizationId ?? row.paypalOrderId ?? '—'}
                    </td>
                    <td className='px-4 py-3'>{row.reason}</td>
                    <td className='px-4 py-3'>{row.recommendedAction}</td>
                    <td className='px-4 py-3'>{row.updated}</td>
                    <td className='px-4 py-3'>
                      <Link
                        href={`/admin/shop/paid-order-recovery/${encodeURIComponent(row.orderToken)}`}
                        className='inline-flex min-w-[78px] items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/10'
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className='p-4'>
          <div className='flex items-start gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100'>
            <CheckCircle2 size={18} className='mt-0.5 shrink-0' />
            <p>No stale payment-stage rows currently need PayPal reconciliation.</p>
          </div>
        </div>
      )}
    </AdminGlassPanel>
  );
}

function MobilePaymentRow({ row }: { row: PayPalPaymentReconciliationRow }) {
  return (
    <Link
      href={`/admin/shop/paid-order-recovery/${encodeURIComponent(row.orderToken)}`}
      className='block bg-slate-950/14 px-4 py-4 transition hover:bg-white/[0.04]'
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium text-white'>{row.customer}</p>
          <p className='mt-1 font-mono text-xs text-cyan-100'>{row.supportRef}</p>
        </div>
        <RiskBadge risk={row.risk} />
      </div>
      <div className='mt-4 grid gap-3 text-xs'>
        <div>
          <p className='text-slate-500'>Reason</p>
          <p className='mt-1 text-slate-200'>{row.reason}</p>
        </div>
        <div>
          <p className='text-slate-500'>Next Action</p>
          <p className='mt-1 text-slate-200'>{row.recommendedAction}</p>
        </div>
      </div>
    </Link>
  );
}

function RiskBadge({ risk }: { risk: PayPalPaymentReconciliationRow['risk'] }) {
  const tone =
    risk === 'critical'
      ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
      : risk === 'warning'
        ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
        : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100';

  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs', tone)}
    >
      {risk === 'critical' ? <AlertTriangle size={13} /> : null}
      {risk}
    </span>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
