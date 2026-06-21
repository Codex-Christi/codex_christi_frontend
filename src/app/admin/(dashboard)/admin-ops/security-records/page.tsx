import type { Metadata } from 'next';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  DatabaseZap,
  Filter,
  KeyRound,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  countAdminAuditLogsForDashboard,
  listAdminAuditLogsForDashboard,
  type AdminAuditLogFilters,
  type AdminAuditLogSummary,
} from '@/lib/admin/admin-auth-ledger';
import { isMasterAdminRole } from '@/lib/admin/admin-config';
import {
  ADMIN_OPS_LEDGER_MINIMUM_STORAGE_RETENTION_POLICY,
  getAdminOpsLedgerPruneTotal,
} from '@/lib/admin/admin-ops-ledger-maintenance-core';
import { previewAdminOpsLedgerMinimumStoragePrune } from '@/lib/admin/admin-ops-ledger-maintenance';
import AdminAuditLogClearRangeDialog from '@/components/UI/Admin/AdminAuditLogClearRangeDialog';
import AdminSecurityRecordsPruneDialog from '@/components/UI/Admin/AdminSecurityRecordsPruneDialog';
import AdminGlassPanel, {
  adminFieldClass,
  adminInsetSurfaceClass,
  getAdminGlassPanelClassName,
} from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import { requireAdminPage } from '@/lib/admin/require-admin';

type AdminSecurityRecordsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: 'Admin Security Records | Codex Christi',
};

const outcomeOptions = ['success', 'failure', 'blocked', 'started'] as const;
const ACTIVITY_PAGE_SIZE = 25;

export default async function AdminSecurityRecordsPage({
  searchParams,
}: AdminSecurityRecordsPageProps) {
  const params = (await searchParams) ?? {};
  const filters = getAuditLogFilters(params);
  const requestedPage = getPositiveIntegerParam(params.page) ?? 1;
  const admin = await requireAdminPage({
    scope: 'audit.view',
    returnPath: '/admin/admin-ops/security-records',
  });
  const isMasterAdmin = isMasterAdminRole(admin.role);
  const [auditLogCount, maintenancePreview] = await Promise.all([
    countAdminAuditLogsForDashboard({ filters }),
    isMasterAdmin
      ? previewAdminOpsLedgerMinimumStoragePrune().catch(() => null)
      : Promise.resolve(null),
  ]);
  const totalPages = Math.max(1, Math.ceil(auditLogCount / ACTIVITY_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const auditLogs = await listAdminAuditLogsForDashboard({
    filters,
    skip: (currentPage - 1) * ACTIVITY_PAGE_SIZE,
    take: ACTIVITY_PAGE_SIZE,
  });
  const backHref = isMasterAdmin ? '/admin/admin-ops' : '/admin';
  const eligibleTotal = maintenancePreview
    ? getAdminOpsLedgerPruneTotal(maintenancePreview.eligible)
    : 0;
  const currentPageStart = auditLogCount ? (currentPage - 1) * ACTIVITY_PAGE_SIZE + 1 : 0;
  const currentPageEnd = Math.min(currentPage * ACTIVITY_PAGE_SIZE, auditLogCount);

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
              {isMasterAdmin ? 'Admin Ops' : 'Admin Dashboard'}
            </Link>
            <div className='space-y-2'>
              <div className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100'>
                <ShieldCheck size={14} />
                Security Records
              </div>
              <h1 className='text-3xl font-semibold tracking-normal text-white sm:text-4xl'>
                Admin Security Records
              </h1>
              <p className='max-w-3xl text-sm leading-6 text-slate-300 sm:text-base'>
                Review admin activity and maintain the security records that support unlock
                attempts, audit history, and master-admin transfers.
              </p>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-3 lg:min-w-[520px]'>
            <MetricPill
              label='Matches'
              value={`${auditLogCount}`}
              icon={ScrollText}
              tone='cyan'
            />
            <MetricPill
              label='Access'
              value={isMasterAdmin ? 'Master' : 'Audit'}
              icon={ShieldCheck}
              tone='emerald'
            />
            <MetricPill
              label='Cleanup'
              value={isMasterAdmin ? `${eligibleTotal}` : 'Restricted'}
              icon={DatabaseZap}
              tone={eligibleTotal ? 'amber' : 'cyan'}
            />
          </div>
        </div>
      </AdminGlassPanel>

      <div className='grid gap-3 md:grid-cols-2'>
        <AnchorCard
          href='#activity'
          icon={ScrollText}
          title='Activity'
          description='Filter and inspect recent admin actions, outcomes, actors, and request fingerprints.'
        />
        <AnchorCard
          href={isMasterAdmin ? '#maintenance' : '#activity'}
          icon={DatabaseZap}
          title='Maintenance'
          description={
            isMasterAdmin
              ? 'Preview retention cleanup and run destructive maintenance with password confirmation.'
              : 'Maintenance is restricted to master admins.'
          }
        />
      </div>

      <section id='activity' className='scroll-mt-24 space-y-6'>
        <SectionHeading
          icon={ScrollText}
          eyebrow='Activity'
          title='Admin Activity'
          description='Browse the newest matching audit events. Maintenance controls are kept separate from the activity list.'
        />

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
              <select
                name='outcome'
                defaultValue={filters.outcome ?? ''}
                className={adminFieldClass}
              >
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
              href='/admin/admin-ops/security-records'
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
                Newest matching events, paginated for faster review.
              </p>
            </div>
            <span className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300'>
              {auditLogCount
                ? `${currentPageStart}-${currentPageEnd} of ${auditLogCount}`
                : '0 shown'}
            </span>
          </div>

          {auditLogs.length ? (
            <>
              <div className='grid gap-3'>
                {auditLogs.map((auditLog) => (
                  <AuditLogCard key={auditLog.id} auditLog={auditLog} />
                ))}
              </div>
              <PaginationControls
                currentPage={currentPage}
                filters={filters}
                totalPages={totalPages}
              />
            </>
          ) : (
            <p className='rounded-lg border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-sm text-amber-100'>
              No audit logs match these filters.
            </p>
          )}
        </AdminGlassPanel>
      </section>

      {isMasterAdmin ? (
        <section id='maintenance' className='scroll-mt-24 space-y-6'>
          <SectionHeading
            icon={DatabaseZap}
            eyebrow='Maintenance'
            title='Security Records Maintenance'
            description='Preview retention cleanup and run storage-control actions from one master-only surface.'
          />

          <div className='grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]'>
            <AdminGlassPanel className='p-4 sm:p-5'>
              <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <h2 className='text-base font-semibold text-white'>Minimum-Storage Preview</h2>
                  <p className='mt-1 text-sm leading-6 text-slate-400'>
                    Eligible records are calculated with the same retention policy used by the Yarn
                    cleanup script.
                  </p>
                </div>
                <AdminSecurityRecordsPruneDialog eligibleTotal={eligibleTotal} />
              </div>

              {maintenancePreview ? (
                <div className='grid gap-3 md:grid-cols-3'>
                  <RetentionCard
                    label='Unlock Attempts'
                    value={maintenancePreview.eligible.unlockAttempts}
                    retention={`Keep ${ADMIN_OPS_LEDGER_MINIMUM_STORAGE_RETENTION_POLICY.unlockAttemptRetentionHours}h`}
                    cutoff={maintenancePreview.cutoffs.unlockAttemptCreatedBefore}
                    icon={KeyRound}
                  />
                  <RetentionCard
                    label='Audit Logs'
                    value={maintenancePreview.eligible.auditLogs}
                    retention={`Keep ${ADMIN_OPS_LEDGER_MINIMUM_STORAGE_RETENTION_POLICY.auditLogRetentionDays}d`}
                    cutoff={maintenancePreview.cutoffs.auditLogCreatedBefore}
                    icon={ScrollText}
                  />
                  <RetentionCard
                    label='Transfer Challenges'
                    value={maintenancePreview.eligible.masterTransferChallenges}
                    retention={`Keep ${ADMIN_OPS_LEDGER_MINIMUM_STORAGE_RETENTION_POLICY.masterTransferChallengeRetentionHours}h`}
                    cutoff={maintenancePreview.cutoffs.masterTransferChallengeCreatedBefore}
                    icon={Clock3}
                  />
                </div>
              ) : (
                <p className='rounded-lg border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-sm text-amber-100'>
                  Maintenance preview could not be loaded. Confirm the Admin Ops Ledger database is
                  configured.
                </p>
              )}
            </AdminGlassPanel>

            <AdminGlassPanel className='p-4 sm:p-5'>
              <div className='flex h-full flex-col gap-4'>
                <div className='min-w-0'>
                  <div className='mb-3 inline-flex items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-rose-100'>
                    <Trash2 size={14} />
                    Manual Cleanup
                  </div>
                  <h2 className='text-base font-semibold text-white'>Clear Audit Range</h2>
                  <p className='mt-1 text-sm leading-6 text-slate-400'>
                    Delete audit events by created-at range. This is separate from retention cleanup
                    and is intended for deliberate manual cleanup.
                  </p>
                </div>
                <div className='mt-auto'>
                  <AdminAuditLogClearRangeDialog />
                </div>
              </div>
            </AdminGlassPanel>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PaginationControls({
  currentPage,
  filters,
  totalPages,
}: {
  currentPage: number;
  filters: AdminAuditLogFilters;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label='Admin activity pagination'
      className='mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between'
    >
      <p className='text-xs text-slate-500'>
        Page {currentPage} of {totalPages}
      </p>
      <div className='flex flex-wrap items-center gap-2'>
        <PaginationLink
          disabled={currentPage <= 1}
          href={buildSecurityRecordsHref({ filters, page: currentPage - 1 })}
          label='Previous'
          icon='previous'
        />
        {getPaginationItems(currentPage, totalPages).map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              className='grid h-9 min-w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.025] px-2 text-xs text-slate-500'
            >
              ...
            </span>
          ) : (
            <Link
              key={item}
              href={buildSecurityRecordsHref({ filters, page: item })}
              aria-current={item === currentPage ? 'page' : undefined}
              className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-semibold transition ${
                item === currentPage
                  ? 'border-cyan-300/30 bg-cyan-300/15 text-cyan-100'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-300/25 hover:text-cyan-100'
              }`}
            >
              {item}
            </Link>
          ),
        )}
        <PaginationLink
          disabled={currentPage >= totalPages}
          href={buildSecurityRecordsHref({ filters, page: currentPage + 1 })}
          label='Next'
          icon='next'
        />
      </div>
    </nav>
  );
}

function PaginationLink({
  disabled,
  href,
  icon,
  label,
}: {
  disabled: boolean;
  href: string;
  icon: 'next' | 'previous';
  label: string;
}) {
  const Icon = icon === 'previous' ? ChevronLeft : ChevronRight;

  if (disabled) {
    return (
      <span className='inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 text-sm font-semibold text-slate-600'>
        {icon === 'previous' ? <Icon size={15} /> : null}
        {label}
        {icon === 'next' ? <Icon size={15} /> : null}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className='inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/25 hover:text-cyan-100'
    >
      {icon === 'previous' ? <Icon size={15} /> : null}
      {label}
      {icon === 'next' ? <Icon size={15} /> : null}
    </Link>
  );
}

function getPaginationItems(currentPage: number, totalPages: number) {
  const items: Array<number | 'ellipsis'> = [];
  let previousIncludedPage = 0;

  for (let page = 1; page <= totalPages; page += 1) {
    const shouldInclude =
      page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;

    if (!shouldInclude) {
      continue;
    }

    if (previousIncludedPage && page - previousIncludedPage > 1) {
      items.push('ellipsis');
    }

    items.push(page);
    previousIncludedPage = page;
  }

  return items;
}

function AnchorCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className={getAdminGlassPanelClassName('group p-4 sm:p-5', {
        interactive: true,
      })}
    >
      <div className='flex items-start gap-3'>
        <span className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100'>
          <Icon size={20} />
        </span>
        <div className='min-w-0'>
          <h2 className='text-base font-semibold text-white'>{title}</h2>
          <p className='mt-1 text-sm leading-6 text-slate-400'>{description}</p>
        </div>
      </div>
    </Link>
  );
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className='space-y-2'>
      <div className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100'>
        <Icon size={14} />
        {eyebrow}
      </div>
      <h2 className='text-2xl font-semibold tracking-normal text-white'>{title}</h2>
      <p className='max-w-3xl text-sm leading-6 text-slate-400'>{description}</p>
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
  icon: LucideIcon;
  tone: 'cyan' | 'emerald' | 'amber';
}) {
  const toneClass = {
    cyan: 'text-cyan-200 bg-cyan-300/10 border-cyan-300/20',
    emerald: 'text-emerald-200 bg-emerald-300/10 border-emerald-300/20',
    amber: 'text-amber-200 bg-amber-300/10 border-amber-300/20',
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

function RetentionCard({
  label,
  value,
  retention,
  cutoff,
  icon: Icon,
}: {
  label: string;
  value: number;
  retention: string;
  cutoff: Date;
  icon: LucideIcon;
}) {
  return (
    <article className={`${adminInsetSurfaceClass} p-4`}>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-xs uppercase tracking-[0.14em] text-slate-500'>{label}</p>
          <p className='mt-2 text-2xl font-semibold tracking-normal text-white'>{value}</p>
        </div>
        <span className='grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100'>
          <Icon size={18} />
        </span>
      </div>
      <p className='mt-3 text-xs font-medium text-cyan-100'>{retention}</p>
      <p className='mt-1 text-xs leading-5 text-slate-500'>Deletes records before {formatDateTime(cutoff)}</p>
    </article>
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

function getPositiveIntegerParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? '', 10);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function buildSecurityRecordsHref({
  filters,
  page,
}: {
  filters: AdminAuditLogFilters;
  page: number;
}) {
  const params = new URLSearchParams();

  setSearchParam(params, 'action', filters.action);
  setSearchParam(params, 'actorCodexUserId', filters.actorCodexUserId);
  setSearchParam(params, 'targetId', filters.targetId);
  setSearchParam(params, 'outcome', filters.outcome);

  if (page > 1) {
    params.set('page', `${page}`);
  }

  const query = params.toString();

  return `/admin/admin-ops/security-records${query ? `?${query}` : ''}#activity`;
}

function setSearchParam(params: URLSearchParams, key: string, value: string | undefined) {
  const trimmed = value?.trim();

  if (trimmed) {
    params.set(key, trimmed);
  }
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
