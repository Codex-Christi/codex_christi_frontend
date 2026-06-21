import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Filter, RotateCcw, ScrollText, ShieldCheck } from 'lucide-react';
import {
  listAdminAuditLogsForDashboard,
  type AdminAuditLogFilters,
  type AdminAuditLogSummary,
} from '@/lib/admin/admin-auth-ledger';
import { isMasterAdminRole } from '@/lib/admin/admin-config';
import AdminAuditLogClearRangeDialog from '@/components/UI/Admin/AdminAuditLogClearRangeDialog';
import AdminGlassPanel, {
  adminFieldClass,
  adminInsetSurfaceClass,
  getAdminGlassPanelClassName,
} from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import { requireAdminPage } from '@/lib/admin/require-admin';

type AdminAuditLogsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: 'Admin Audit Logs | Codex Christi',
};

const outcomeOptions = ['success', 'failure', 'blocked', 'started'] as const;

export default async function AdminAuditLogsPage({ searchParams }: AdminAuditLogsPageProps) {
  const params = (await searchParams) ?? {};
  const filters = getAuditLogFilters(params);
  const admin = await requireAdminPage({
    scope: 'audit.view',
    returnPath: '/admin/admin-ops/audit-logs',
  });
  const auditLogs = await listAdminAuditLogsForDashboard({ filters });
  const backHref = isMasterAdminRole(admin.role) ? '/admin/admin-ops' : '/admin';

  return (
    <div className='mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
      <AdminGlassPanel className='p-5 sm:p-6'>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
          <div className='min-w-0 space-y-4'>
            <Link
              href={backHref}
              className='inline-flex items-center gap-2 text-sm font-medium text-cyan-100 transition hover:text-white'
            >
              <ArrowLeft size={16} />
              {isMasterAdminRole(admin.role) ? 'Admin Ops' : 'Admin Dashboard'}
            </Link>
            <div className='space-y-2'>
              <div className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100'>
                <ScrollText size={14} />
                Audit Logs
              </div>
              <h1 className='text-3xl font-semibold tracking-normal text-white sm:text-4xl'>
                Admin Audit Logs
              </h1>
              <p className='max-w-3xl text-sm leading-6 text-slate-300 sm:text-base'>
                Review admin actions, outcomes, targets, and request fingerprints from the Admin Ops
                Ledger.
              </p>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-2 lg:min-w-[420px]'>
            <MetricPill
              label='Visible'
              value={`${auditLogs.length}`}
              icon={ScrollText}
              tone='cyan'
            />
            <MetricPill
              label='Access'
              value={isMasterAdminRole(admin.role) ? 'Master' : 'Audit'}
              icon={ShieldCheck}
              tone='emerald'
            />
          </div>
        </div>
      </AdminGlassPanel>

      {isMasterAdminRole(admin.role) ? (
        <AdminGlassPanel className='p-4 sm:p-5'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0'>
              <h2 className='text-base font-semibold text-white'>Audit Log Maintenance</h2>
              <p className='mt-1 max-w-3xl text-sm leading-6 text-slate-400'>
                Clear audit events by created-at range. Clear-operation audit events are preserved
                for accountability.
              </p>
            </div>
            <AdminAuditLogClearRangeDialog />
          </div>
        </AdminGlassPanel>
      ) : null}

      <AdminGlassPanel className='p-4 sm:p-5'>
        <div className='mb-4 flex items-center justify-between gap-3'>
          <div>
            <h2 className='text-base font-semibold text-white'>Filters</h2>
            <p className='mt-1 text-sm leading-6 text-slate-400'>
              Narrow by action, actor, target, or outcome.
            </p>
          </div>
          <span className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100'>
            <Filter size={20} />
          </span>
        </div>

        <form className='grid gap-3 lg:grid-cols-[1fr_1fr_1fr_180px_auto_auto] lg:items-end'>
          <TextField label='Action contains' name='action' defaultValue={filters.action} />
          <TextField
            label='Actor Codex Christi user ID'
            name='actorCodexUserId'
            defaultValue={filters.actorCodexUserId}
          />
          <TextField label='Target ID contains' name='targetId' defaultValue={filters.targetId} />

          <label className='grid gap-1 text-xs font-medium text-slate-300'>
            Outcome
            <select name='outcome' defaultValue={filters.outcome ?? ''} className={adminFieldClass}>
              <option value=''>Any</option>
              {outcomeOptions.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
          </label>

          <button
            type='submit'
            className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200'
          >
            <Filter size={16} />
            Apply
          </button>
          <Link
            href='/admin/admin-ops/audit-logs'
            className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
          >
            <RotateCcw size={16} />
            Reset
          </Link>
        </form>
      </AdminGlassPanel>

      <AdminGlassPanel className='p-4 sm:p-5'>
        <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-base font-semibold text-white'>Recent Activity</h2>
            <p className='mt-1 text-sm text-slate-400'>
              Newest matching events, capped at 100 rows.
            </p>
          </div>
          <span className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300'>
            {auditLogs.length} shown
          </span>
        </div>

        {auditLogs.length ? (
          <div className='grid gap-3'>
            {auditLogs.map((auditLog) => (
              <AuditLogCard key={auditLog.id} auditLog={auditLog} />
            ))}
          </div>
        ) : (
          <p className='rounded-lg border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-sm text-amber-100'>
            No audit logs match these filters.
          </p>
        )}
      </AdminGlassPanel>
    </div>
  );
}

function TextField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className='grid gap-1 text-xs font-medium text-slate-300'>
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        autoComplete='off'
        className={adminFieldClass}
      />
    </label>
  );
}

function MetricPill({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof ScrollText;
  tone: 'cyan' | 'emerald';
}) {
  const toneClass = {
    cyan: 'text-cyan-200 bg-cyan-300/10 border-cyan-300/20',
    emerald: 'text-emerald-200 bg-emerald-300/10 border-emerald-300/20',
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-3 ${toneClass}`}>
      <div className='flex items-center gap-2 text-xs uppercase tracking-[0.14em]'>
        <Icon size={14} />
        {label}
      </div>
      <p className='mt-2 text-lg font-semibold tracking-normal text-white'>{value}</p>
    </div>
  );
}

function AuditLogCard({ auditLog }: { auditLog: AdminAuditLogSummary }) {
  const metadata = formatMetadata(auditLog.metadata);

  return (
    <article className={getAdminGlassPanelClassName('p-4')}>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
        <div className='min-w-0 space-y-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <span
              className={`rounded-md border px-2 py-1 text-xs ${getOutcomeClass(auditLog.outcome)}`}
            >
              {auditLog.outcome}
            </span>
            <time className='text-xs text-slate-500' dateTime={auditLog.createdAt.toISOString()}>
              {formatDateTime(auditLog.createdAt)}
            </time>
          </div>
          <h3 className='break-words text-sm font-semibold text-white'>{auditLog.action}</h3>
          <p className='break-words text-xs leading-5 text-slate-400'>
            Actor: {auditLog.actorCodexUserId ?? 'system'} · Target: {auditLog.targetType ?? 'none'}{' '}
            {auditLog.targetId ? `/ ${auditLog.targetId}` : ''}
          </p>
        </div>

        <div className='grid shrink-0 gap-1 text-xs text-slate-500 lg:min-w-[220px]'>
          <span className='truncate'>IP: {auditLog.ipHash ?? 'none'}</span>
          <span className='truncate'>UA: {auditLog.userAgentHash ?? 'none'}</span>
        </div>
      </div>

      {metadata ? (
        <pre
          className={`${adminInsetSurfaceClass} mt-3 max-h-44 overflow-auto p-3 text-xs leading-5 text-slate-300`}
        >
          {metadata}
        </pre>
      ) : null}
    </article>
  );
}

function getAuditLogFilters(
  params: Record<string, string | string[] | undefined>,
): AdminAuditLogFilters {
  return {
    action: getSingleParam(params.action),
    actorCodexUserId: getSingleParam(params.actorCodexUserId),
    outcome: getSingleParam(params.outcome),
    targetId: getSingleParam(params.targetId),
  };
}

function getSingleParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();

  return trimmed || undefined;
}

function formatMetadata(metadata: unknown) {
  if (!metadata) return null;

  const text = JSON.stringify(metadata, null, 2);

  if (!text || text === '{}') return null;

  return text.length > 700 ? `${text.slice(0, 700)}...` : text;
}

function getOutcomeClass(outcome: string) {
  if (outcome === 'success') return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
  if (outcome === 'failure') return 'border-rose-300/20 bg-rose-300/10 text-rose-100';
  if (outcome === 'blocked') return 'border-amber-300/20 bg-amber-300/10 text-amber-100';

  return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100';
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
