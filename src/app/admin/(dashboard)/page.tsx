import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Lock,
  ScrollText,
  ShoppingBag,
  Sparkles,
  Store,
  UserRoundCog,
  type LucideIcon,
} from 'lucide-react';
import { isAdminScopeAllowed, isMasterAdminRole } from '@/lib/admin/admin-config';
import AdminSystemTimeGreeting from '@/components/UI/Admin/AdminSystemTimeGreeting';
import AdminGlassPanel, {
  adminInsetSurfaceClass,
  getAdminGlassPanelClassName,
} from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import { getAdminOpsDashboardSummary } from '@/lib/admin/admin-auth-ledger';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { getUser } from '@/lib/funcs/userProfileFetchers/getUser';
import { listAdminPaidOrderRecoveryRows } from '@/lib/paypal/txLedger/adminPaidOrderRecovery';
import { getPayPalPaymentReconciliationDashboardSummary } from '@/lib/paypal/txLedger/paymentReconciliation';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Admin | Codex Christi',
};

const dailyFacts = [
  'Recovery queues are most useful when every row has one clear next action.',
  'Short admin sessions reduce the blast radius of unattended devices.',
  'Audit logs are operational memory for future incidents.',
  'A calm dashboard should show what needs attention before what looks impressive.',
];

const dailyJokes = [
  'The best admin dashboard is the one that makes the red badge boring again.',
  'A retry button without an audit trail is just optimism with a cursor.',
  'Static metrics are decorations. Live metrics pay rent.',
  'A short session timer is annoying right up until it saves you.',
];

export default async function AdminPage() {
  const admin = await requireAdminPage({
    returnPath: '/admin',
  });
  const canManageAdmins = isMasterAdminRole(admin.role);
  const canAccessShopOverview = isAdminScopeAllowed(admin.scopes, 'shop', admin.role);
  const canAccessShopTools = isAdminScopeAllowed(admin.scopes, 'shop.view', admin.role);
  const canViewAuditLogs = isAdminScopeAllowed(admin.scopes, 'audit.view', admin.role);

  const shouldLoadAdminOpsSummary = canManageAdmins || canViewAuditLogs;
  const shouldLoadShopSummaries = canAccessShopTools;
  const [profile, recoveryRows, reconciliationSummary, adminOpsSummary] = await Promise.all([
    getUser().catch(() => undefined),
    shouldLoadShopSummaries
      ? listAdminPaidOrderRecoveryRows()
          .then((result) => result.rows)
          .catch(() => [])
      : Promise.resolve([]),
    shouldLoadShopSummaries
      ? getPayPalPaymentReconciliationDashboardSummary().catch(() => null)
      : Promise.resolve(null),
    shouldLoadAdminOpsSummary
      ? getAdminOpsDashboardSummary().catch(() => null)
      : Promise.resolve(null),
  ]);
  const displayName =
    profile?.first_name?.trim() || profile?.username?.trim() || `Admin ${admin.userID.slice(0, 8)}`;
  const dailyIndex = getDailyIndex(new Date(), admin.userID);
  const attentionRows = recoveryRows.filter((row) =>
    ['failed', 'recovery', 'pending', 'sync', 'attention'].includes(row.status),
  );
  const failedRows = recoveryRows.filter((row) => row.status === 'failed');
  const syncRows = recoveryRows.filter((row) => row.status === 'sync');
  const paymentReconciliationAttentionCount = reconciliationSummary?.total ?? 0;
  const paymentReconciliationCriticalCount = reconciliationSummary?.critical ?? 0;
  const paymentReconciliationWarningCount = reconciliationSummary?.warning ?? 0;
  const totalShopAttentionCount = attentionRows.length + paymentReconciliationAttentionCount;

  return (
    <div className='mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
      <AdminGlassPanel className='p-5 sm:p-6'>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
          <div className='min-w-0 space-y-4'>
            <div className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100'>
              <Sparkles size={14} />
              Admin
            </div>
            <div className='space-y-2'>
              <AdminSystemTimeGreeting displayName={displayName} />
              <p className='max-w-3xl text-sm leading-6 text-slate-300 sm:text-base'>
                {dailyFacts[dailyIndex % dailyFacts.length]}
              </p>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-3 lg:min-w-[520px]'>
            <StatusPill
              label='System'
              value={
                failedRows.length || paymentReconciliationCriticalCount ? 'Needs review' : 'Stable'
              }
              tone={failedRows.length || paymentReconciliationCriticalCount ? 'amber' : 'emerald'}
              icon={
                failedRows.length || paymentReconciliationCriticalCount
                  ? AlertTriangle
                  : CheckCircle2
              }
            />
            <StatusPill
              label='Attention'
              value={`${totalShopAttentionCount}`}
              tone={totalShopAttentionCount ? 'cyan' : 'emerald'}
              icon={Clock3}
            />
            <StatusPill label='Admin Mode' value='Unlocked' tone='cyan' icon={Lock} />
          </div>
        </div>
      </AdminGlassPanel>

      <section className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='grid gap-4 md:grid-cols-2 2xl:grid-cols-3'>
          <ProductCard
            title='Shop Operations'
            description='Hub for paid order recovery, PayPal reconciliation, catalog snapshots, and storefront support tools.'
            href={canAccessShopOverview ? '/admin/shop' : undefined}
            icon={ShoppingBag}
            status={
              canAccessShopOverview ? 'Overview' : canAccessShopTools ? 'Tools only' : 'Restricted'
            }
            attention={
              canAccessShopTools
                ? `${totalShopAttentionCount} needs review`
                : canAccessShopOverview
                  ? 'Overview available'
                  : 'No access'
            }
            metrics={
              canAccessShopTools
                ? [
                    {
                      label: 'Recovery',
                      value: `${attentionRows.length}`,
                      tone: attentionRows.length ? 'cyan' : 'emerald',
                    },
                    {
                      label: 'PayPal',
                      value: `${paymentReconciliationAttentionCount}`,
                      tone: paymentReconciliationAttentionCount ? 'amber' : 'emerald',
                    },
                    {
                      label: 'Failed',
                      value: `${failedRows.length}`,
                      tone: failedRows.length ? 'rose' : 'emerald',
                    },
                  ]
                : undefined
            }
          />
          <ProductCard
            title='Paid Order Recovery'
            description='Review paid checkout rows that need recovery, provider sync, or failure handling.'
            href={canAccessShopTools ? '/admin/shop/paid-order-recovery' : undefined}
            icon={ClipboardList}
            status={canAccessShopTools ? 'Live queue' : 'Restricted'}
            attention={canAccessShopTools ? `${attentionRows.length} active rows` : 'No access'}
            metrics={
              canAccessShopTools
                ? [
                    {
                      label: 'Active',
                      value: `${attentionRows.length}`,
                      tone: attentionRows.length ? 'cyan' : 'emerald',
                    },
                    {
                      label: 'Failed',
                      value: `${failedRows.length}`,
                      tone: failedRows.length ? 'rose' : 'emerald',
                    },
                    {
                      label: 'Sync',
                      value: `${syncRows.length}`,
                      tone: syncRows.length ? 'amber' : 'emerald',
                    },
                  ]
                : undefined
            }
          />
          <ProductCard
            title='PayPal Reconciliation'
            description='Check PayPal authorization and capture truth before recovery or fulfillment decisions.'
            href={canAccessShopTools ? '/admin/shop/paypal-reconciliation' : undefined}
            icon={BarChart3}
            status={canAccessShopTools ? 'Payment checks' : 'Restricted'}
            attention={
              canAccessShopTools
                ? `${paymentReconciliationAttentionCount} payment rows`
                : 'No access'
            }
            metrics={
              canAccessShopTools
                ? [
                    {
                      label: 'Critical',
                      value: `${paymentReconciliationCriticalCount}`,
                      tone: paymentReconciliationCriticalCount ? 'rose' : 'emerald',
                    },
                    {
                      label: 'Warning',
                      value: `${paymentReconciliationWarningCount}`,
                      tone: paymentReconciliationWarningCount ? 'amber' : 'emerald',
                    },
                    {
                      label: 'Total',
                      value: `${paymentReconciliationAttentionCount}`,
                      tone: paymentReconciliationAttentionCount ? 'cyan' : 'emerald',
                    },
                  ]
                : undefined
            }
          />
          <ProductCard
            title='Catalog & Snapshots'
            description='Inspect Merchize catalog sync state, sample variants, shipping bands, and storefront fallback snapshots.'
            href={canAccessShopTools ? '/admin/shop/merchize-catalog-snapshots' : undefined}
            icon={Store}
            status={canAccessShopTools ? 'Catalog tool' : 'Restricted'}
            attention={canAccessShopTools ? 'Open implemented tool' : 'No access'}
            metrics={
              canAccessShopTools
                ? [
                    { label: 'Route', value: 'Available', tone: 'cyan' },
                    { label: 'Scope', value: 'shop.view', tone: 'emerald' },
                  ]
                : undefined
            }
          />
          {canManageAdmins ? (
            <ProductCard
              title='Admin Ops'
              description='Operational admin creation, scope control, access review, and master-admin transfer.'
              href='/admin/admin-ops'
              icon={UserRoundCog}
              status='Master only'
              attention={
                adminOpsSummary
                  ? `${adminOpsSummary.activeAdmins} active admins`
                  : 'Access management'
              }
              metrics={
                adminOpsSummary
                  ? [
                      {
                        label: 'Active',
                        value: `${adminOpsSummary.activeAdmins}`,
                        tone: 'emerald',
                      },
                      {
                        label: 'Disabled',
                        value: `${adminOpsSummary.disabledAdmins}`,
                        tone: 'amber',
                      },
                    ]
                  : undefined
              }
            />
          ) : null}
          {canManageAdmins ? (
            <ProductCard
              title='Notification Recipients'
              description='Manage default operational recipients and per-group admin notification routing.'
              href='/admin/admin-ops/notification-recipients'
              icon={BellRing}
              status='Routing'
              attention='Operational email routing'
              metrics={
                adminOpsSummary
                  ? [
                      {
                        label: 'Admin Sources',
                        value: `${adminOpsSummary.activeAdmins}`,
                        tone: 'emerald',
                      },
                      {
                        label: 'Disabled',
                        value: `${adminOpsSummary.disabledAdmins}`,
                        tone: adminOpsSummary.disabledAdmins ? 'amber' : 'emerald',
                      },
                    ]
                  : undefined
              }
            />
          ) : null}
          {canViewAuditLogs ? (
            <ProductCard
              title='Admin Security Records'
              description='Review admin activity, outcomes, targets, and request fingerprints.'
              href='/admin/admin-ops/security-records'
              icon={ScrollText}
              status='Audit'
              attention={
                adminOpsSummary
                  ? `${adminOpsSummary.recentAuditIssues} issues in ${adminOpsSummary.recentAuditWindowHours}h`
                  : 'Recent activity'
              }
              metrics={
                adminOpsSummary
                  ? [
                      {
                        label: 'Issues',
                        value: `${adminOpsSummary.recentAuditIssues}`,
                        tone: adminOpsSummary.recentAuditIssues ? 'amber' : 'emerald',
                      },
                    ]
                  : undefined
              }
            />
          ) : null}
        </div>

        <aside className='space-y-4'>
          <AdminGlassPanel className='p-4'>
            <h2 className='text-sm font-semibold text-white'>Pending Attention</h2>
            <div className='mt-4 space-y-3'>
              <AttentionRow label='Paid order recovery' value={attentionRows.length} />
              <AttentionRow label='Failed rows' value={failedRows.length} tone='rose' />
              <AttentionRow label='Provider sync' value={syncRows.length} tone='amber' />
              <AttentionRow
                label='PayPal reconciliation'
                value={paymentReconciliationAttentionCount}
                tone={paymentReconciliationCriticalCount ? 'rose' : 'amber'}
              />
            </div>
          </AdminGlassPanel>

          <AdminGlassPanel className='p-4'>
            <h2 className='text-sm font-semibold text-white'>Daily Note</h2>
            <p className='mt-3 text-sm leading-6 text-slate-300'>
              {dailyJokes[dailyIndex % dailyJokes.length]}
            </p>
          </AdminGlassPanel>

          <AdminGlassPanel className='p-4'>
            <div className='flex items-center justify-between gap-3'>
              <h2 className='text-sm font-semibold text-white'>Admin Access</h2>
              <span className='rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100'>
                {admin.role}
              </span>
            </div>
            <p className='mt-2 truncate text-xs text-slate-400'>{admin.email ?? admin.userID}</p>
            <div className='mt-3 flex flex-wrap gap-2'>
              {admin.scopes.map((scope) => (
                <span
                  key={scope}
                  className='rounded-md border border-cyan-300/15 bg-cyan-300/10 px-2 py-1 text-[11px] text-cyan-100'
                >
                  {scope}
                </span>
              ))}
            </div>
          </AdminGlassPanel>
        </aside>
      </section>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: 'cyan' | 'emerald' | 'amber';
  icon: LucideIcon;
}) {
  const toneClass = {
    cyan: 'text-cyan-100 bg-cyan-300/[0.06]',
    emerald: 'text-emerald-100 bg-emerald-300/[0.06]',
    amber: 'text-amber-100 bg-amber-300/[0.06]',
  }[tone];

  return (
    <div
      className={`rounded-lg px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${toneClass}`}
    >
      <div className='flex items-center gap-2 text-xs uppercase tracking-[0.14em]'>
        <Icon size={14} />
        {label}
      </div>
      <p className='mt-2 text-lg font-semibold tracking-normal text-white'>{value}</p>
    </div>
  );
}

function ProductCard({
  title,
  description,
  icon: Icon,
  status,
  attention,
  metrics,
  href,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  status: string;
  attention?: string;
  metrics?: ProductMetric[];
  href?: string;
}) {
  const body = (
    <article
      className={getAdminGlassPanelClassName(
        'group flex min-h-0 flex-col justify-between p-3.5 sm:min-h-[220px] sm:p-4 xl:min-h-[230px]',
        { interactive: Boolean(href) },
      )}
    >
      <div className='space-y-2 sm:space-y-4'>
        <div className='flex items-start justify-between gap-3'>
          <span
            className={cn(
              adminInsetSurfaceClass,
              'grid h-9 w-9 shrink-0 place-items-center text-cyan-200 sm:h-10 sm:w-10',
            )}
          >
            <Icon size={19} />
          </span>
          <span className='max-w-[9rem] shrink-0 truncate rounded-md bg-white/[0.035] px-2 py-1 text-[11px] text-slate-300 sm:text-xs'>
            {status}
          </span>
        </div>
        <div className='space-y-1.5'>
          <h2 className='text-base font-semibold text-white'>{title}</h2>
          <p className='sr-only text-sm leading-5 text-slate-300 sm:not-sr-only sm:line-clamp-2'>
            {description}
          </p>
        </div>
        {metrics?.length ? (
          <div className='grid grid-cols-3 gap-2 border-t border-white/[0.045] pt-2'>
            {metrics.map((metric) => (
              <span key={`${title}-${metric.label}`} className='min-w-0 text-xs'>
                <span className='block truncate text-[9px] uppercase leading-3 tracking-[0.12em] text-slate-500 sm:text-[10px]'>
                  {metric.label}
                </span>
                <span
                  className={cn(
                    'mt-0.5 block text-sm font-semibold leading-4',
                    getMetricToneClass(metric.tone),
                  )}
                >
                  {metric.value}
                </span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className='hidden items-center justify-between gap-2 border-t border-white/[0.045] text-xs sm:mt-4 sm:flex sm:gap-3 sm:pt-3 sm:text-sm'>
        <span className='min-w-0 truncate text-slate-400'>{attention ?? 'No active tool'}</span>
        <span className='inline-flex shrink-0 items-center gap-2 text-cyan-100'>
          {href ? 'Open' : 'Unavailable'}
          {href ? <ArrowRight size={15} /> : null}
        </span>
      </div>
    </article>
  );

  if (!href) {
    return <div className='opacity-75'>{body}</div>;
  }

  return (
    <Link
      href={href}
      className='block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70'
    >
      {body}
    </Link>
  );
}

function AttentionRow({
  label,
  value,
  tone = 'cyan',
}: {
  label: string;
  value: number;
  tone?: 'cyan' | 'amber' | 'rose';
}) {
  const toneClass = {
    cyan: 'text-cyan-200',
    amber: 'text-amber-200',
    rose: 'text-rose-200',
  }[tone];

  return (
    <div
      className={cn(adminInsetSurfaceClass, 'flex items-center justify-between gap-3 px-3 py-2')}
    >
      <span className='truncate text-sm text-slate-300'>{label}</span>
      <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

type ProductMetric = {
  label: string;
  value: string;
  tone: 'cyan' | 'emerald' | 'amber' | 'rose';
};

function getMetricToneClass(tone: ProductMetric['tone']) {
  return {
    cyan: 'text-cyan-100',
    emerald: 'text-emerald-100',
    amber: 'text-amber-100',
    rose: 'text-rose-100',
  }[tone];
}

function getDailyIndex(date: Date, userID: string) {
  const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

  return [...`${dateKey}-${userID}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
