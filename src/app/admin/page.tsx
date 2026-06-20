import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Lock,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react';
import { listAdminUsersForDashboard } from '@/lib/admin/admin-auth-ledger';
import { isAdminScopeAllowed, isMasterAdminRole } from '@/lib/admin/admin-config';
import AdminUserProvisioningForm from '@/components/UI/Admin/AdminUserProvisioningForm';
import CometsContainer from '@/components/UI/general/CometsContainer';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { getUser } from '@/lib/funcs/userProfileFetchers/getUser';
import { listAdminPaidOrderRecoveryRows } from '@/lib/paypal/txLedger/adminPaidOrderRecovery';

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
  const canAccessShop = isAdminScopeAllowed(admin.scopes, 'shop', admin.role);

  const [profile, recoveryRows, adminUsers] = await Promise.all([
    getUser().catch(() => undefined),
    canAccessShop ? listAdminPaidOrderRecoveryRows().catch(() => []) : Promise.resolve([]),
    canManageAdmins ? listAdminUsersForDashboard().catch(() => []) : Promise.resolve([]),
  ]);
  const displayName =
    profile?.first_name?.trim() || profile?.username?.trim() || `Admin ${admin.userID.slice(0, 8)}`;
  const now = new Date();
  const greeting = getTimeGreeting(now);
  const dailyIndex = getDailyIndex(now, admin.userID);
  const attentionRows = recoveryRows.filter((row) =>
    ['failed', 'recovery', 'pending', 'sync'].includes(row.status),
  );
  const failedRows = recoveryRows.filter((row) => row.status === 'failed');
  const syncRows = recoveryRows.filter((row) => row.status === 'sync');

  return (
    <DefaultPageWrapper hasMainNav>
      <CometsContainer>
        <main className='min-h-dvh bg-slate-950/54 px-4 pb-6 pt-24 text-slate-50 supports-[backdrop-filter]:backdrop-blur-[1px] sm:px-6 lg:px-8'>
          <div className='mx-auto flex w-full max-w-[1500px] flex-col gap-6'>
            <header className='rounded-lg border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20 supports-[backdrop-filter]:backdrop-blur-xl sm:p-6'>
              <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
                <div className='min-w-0 space-y-4'>
                  <div className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100'>
                    <Sparkles size={14} />
                    Admin
                  </div>
                  <div className='space-y-2'>
                    <h1 className='text-3xl font-semibold tracking-normal text-white sm:text-4xl'>
                      {greeting}, {displayName}
                    </h1>
                    <p className='max-w-3xl text-sm leading-6 text-slate-300 sm:text-base'>
                      {dailyFacts[dailyIndex % dailyFacts.length]}
                    </p>
                  </div>
                </div>

                <div className='grid gap-3 sm:grid-cols-3 lg:min-w-[520px]'>
                  <StatusPill
                    label='System'
                    value={failedRows.length ? 'Needs review' : 'Stable'}
                    tone={failedRows.length ? 'amber' : 'emerald'}
                    icon={failedRows.length ? AlertTriangle : CheckCircle2}
                  />
                  <StatusPill
                    label='Attention'
                    value={`${attentionRows.length}`}
                    tone={attentionRows.length ? 'cyan' : 'emerald'}
                    icon={Clock3}
                  />
                  <StatusPill label='Admin Mode' value='Unlocked' tone='cyan' icon={Lock} />
                </div>
              </div>
            </header>

            <section className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]'>
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                <ProductCard
                  title='Codex Christi Shop'
                  description='Payments, checkout recovery, fulfillment support, catalog snapshots, and shop operations.'
                  href={canAccessShop ? '/admin/shop' : undefined}
                  icon={ShoppingBag}
                  status={canAccessShop ? 'Active' : 'Restricted'}
                  attention={canAccessShop ? `${attentionRows.length} attention` : 'No access'}
                />
                <ProductCard
                  title='Primary Site'
                  description='Future content, user, and publishing operations for the main Codex Christi experience.'
                  icon={Store}
                  status='Coming later'
                />
                <ProductCard
                  title='Reports'
                  description='Future cross-product sales, fulfillment, incident, and support reporting.'
                  icon={CheckCircle2}
                  status='Coming later'
                />
              </div>

              <aside className='space-y-4'>
                <section className='rounded-lg border border-white/10 bg-slate-950/70 p-4 supports-[backdrop-filter]:backdrop-blur-xl'>
                  <h2 className='text-sm font-semibold text-white'>Pending Attention</h2>
                  <div className='mt-4 space-y-3'>
                    <AttentionRow label='Paid order recovery' value={attentionRows.length} />
                    <AttentionRow label='Failed rows' value={failedRows.length} tone='rose' />
                    <AttentionRow label='Provider sync' value={syncRows.length} tone='amber' />
                  </div>
                </section>

                <section className='rounded-lg border border-white/10 bg-slate-950/70 p-4 supports-[backdrop-filter]:backdrop-blur-xl'>
                  <h2 className='text-sm font-semibold text-white'>Daily Note</h2>
                  <p className='mt-3 text-sm leading-6 text-slate-300'>
                    {dailyJokes[dailyIndex % dailyJokes.length]}
                  </p>
                </section>

                <section className='rounded-lg border border-white/10 bg-slate-950/70 p-4 supports-[backdrop-filter]:backdrop-blur-xl'>
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

                  {canManageAdmins ? (
                    <div className='mt-4 border-t border-white/10 pt-4'>
                      <h3 className='mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400'>
                        Create Operational Admin
                      </h3>
                      <AdminUserProvisioningForm />
                    </div>
                  ) : null}

                  {canManageAdmins ? (
                    <div className='mt-4 space-y-2'>
                      {adminUsers.slice(0, 4).map((adminUser) => (
                        <div
                          key={adminUser.id}
                          className='rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2'
                        >
                          <div className='flex items-center justify-between gap-3'>
                            <p className='truncate text-sm text-slate-200'>
                              {adminUser.email ?? adminUser.codexUserId}
                            </p>
                            <span className='text-xs text-slate-500'>{adminUser.status}</span>
                          </div>
                          <p className='mt-1 text-xs text-slate-500'>
                            {adminUser.role ?? 'unknown'} ·{' '}
                            {adminUser.scopes.join(', ') || 'no scopes'}
                          </p>
                        </div>
                      ))}
                      {!adminUsers.length ? (
                        <p className='rounded-lg border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-xs text-amber-100'>
                          Admin ops ledger users could not be loaded.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </aside>
            </section>
          </div>
        </main>
      </CometsContainer>
    </DefaultPageWrapper>
  );
}

function getTimeGreeting(date: Date) {
  const hour = date.getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getDailyIndex(date: Date, userID: string) {
  const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

  return [...`${dateKey}-${userID}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
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
  icon: typeof CheckCircle2;
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

function ProductCard({
  title,
  description,
  icon: Icon,
  status,
  attention,
  href,
}: {
  title: string;
  description: string;
  icon: typeof ShoppingBag;
  status: string;
  attention?: string;
  href?: string;
}) {
  const body = (
    <article className='group flex min-h-[250px] flex-col justify-between rounded-lg border border-white/10 bg-slate-950/70 p-5 transition hover:border-cyan-300/30 hover:bg-slate-900/72 supports-[backdrop-filter]:backdrop-blur-xl'>
      <div className='space-y-5'>
        <div className='flex items-start justify-between gap-3'>
          <span className='grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-200'>
            <Icon size={22} />
          </span>
          <span className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300'>
            {status}
          </span>
        </div>
        <div className='space-y-2'>
          <h2 className='text-lg font-semibold text-white'>{title}</h2>
          <p className='text-sm leading-6 text-slate-300'>{description}</p>
        </div>
      </div>

      <div className='mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm'>
        <span className='text-slate-400'>{attention ?? 'No active tool'}</span>
        <span className='inline-flex items-center gap-2 text-cyan-100'>
          Open
          <ArrowRight size={15} />
        </span>
      </div>
    </article>
  );

  if (!href) {
    return <div className='opacity-75'>{body}</div>;
  }

  return (
    <Link href={href} className='block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70'>
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
    <div className='flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2'>
      <span className='truncate text-sm text-slate-300'>{label}</span>
      <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}
