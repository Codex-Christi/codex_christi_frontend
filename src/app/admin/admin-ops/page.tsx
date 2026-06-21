import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BellRing,
  KeyRound,
  type LucideIcon,
  MailCheck,
  ScrollText,
  ShieldCheck,
  UserRoundCog,
} from 'lucide-react';
import { listAdminUsersForDashboard, type AdminUserSummary } from '@/lib/admin/admin-auth-ledger';
import { isMasterAdminRole } from '@/lib/admin/admin-config';
import AdminOpsManagementModals from '@/components/UI/Admin/AdminOpsManagementModals';
import AdminAmbientSlideshow from '@/components/UI/Admin/dashboard/AdminAmbientSlideshow';
import AdminGlassPanel, {
  adminPageMainClass,
  getAdminGlassPanelClassName,
} from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import CometsContainer from '@/components/UI/general/CometsContainer';
import DefaultPageWrapper from '@/components/UI/general/DefaultPageWrapper';
import {
  ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  listAdminNotificationRecipientGroupsForDashboard,
} from '@/lib/admin/admin-notification-recipients';
import { requireAdminPage } from '@/lib/admin/require-admin';

export default async function AdminOpsPage() {
  const admin = await requireAdminPage({
    returnPath: '/admin/admin-ops',
  });

  if (!isMasterAdminRole(admin.role)) {
    notFound();
  }

  const adminUsers = await listAdminUsersForDashboard().catch(() => []);
  const notificationRecipientGroups =
    await listAdminNotificationRecipientGroupsForDashboard().catch(() => []);
  const activeAdmins = adminUsers.filter((adminUser) => adminUser.status === 'active');
  const disabledAdmins = adminUsers.filter((adminUser) => adminUser.status === 'disabled');
  const notificationSummary = getNotificationRecipientSummary(notificationRecipientGroups);

  return (
    <DefaultPageWrapper hasMainNav>
      <CometsContainer>
        <main className={adminPageMainClass}>
          <AdminAmbientSlideshow />
          <div className='relative z-10 mx-auto flex w-full max-w-[1400px] flex-col gap-6'>
            <AdminGlassPanel className='p-5 sm:p-6'>
              <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
                <div className='min-w-0 space-y-4'>
                  <Link
                    href='/admin'
                    className='inline-flex items-center gap-2 text-sm font-medium text-cyan-100 transition hover:text-white'
                  >
                    <ArrowLeft size={16} />
                    Admin Dashboard
                  </Link>
                  <div className='space-y-2'>
                    <div className='inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100'>
                      <UserRoundCog size={14} />
                      Admin Ops
                    </div>
                    <h1 className='text-3xl font-semibold tracking-normal text-white sm:text-4xl'>
                      Admin Operations
                    </h1>
                    <p className='max-w-3xl text-sm leading-6 text-slate-300 sm:text-base'>
                      Manage operational admin access, scopes, and master-admin transfer from one
                      restricted surface.
                    </p>
                  </div>
                </div>

                <div className='grid gap-3 sm:grid-cols-3 lg:min-w-[520px]'>
                  <MetricPill label='Role' value='Master' icon={ShieldCheck} tone='cyan' />
                  <MetricPill
                    label='Active'
                    value={`${activeAdmins.length}`}
                    icon={BadgeCheck}
                    tone='emerald'
                  />
                  <MetricPill
                    label='Disabled'
                    value={`${disabledAdmins.length}`}
                    icon={KeyRound}
                    tone='amber'
                  />
                </div>
              </div>
            </AdminGlassPanel>

            <AdminOpsManagementModals />

            <section className='grid gap-4 xl:grid-cols-2'>
              <AdminOpsLinkCard
                href='/admin/admin-ops/notification-recipients'
                eyebrow='Notifications'
                icon={BellRing}
                title='Notification Recipients'
                description='Manage global default recipients and route-specific operational email groups.'
                actionLabel='Manage Routing'
              >
                <MetricPill
                  label='Groups'
                  value={`${notificationSummary.enabledGroups}/${notificationSummary.groupCount}`}
                  icon={MailCheck}
                  tone='cyan'
                />
                <MetricPill
                  label='Default'
                  value={`${notificationSummary.defaultRecipientCount}`}
                  icon={BellRing}
                  tone='amber'
                />
              </AdminOpsLinkCard>

              <AdminOpsLinkCard
                href='/admin/admin-ops/audit-logs'
                eyebrow='Audit'
                icon={ScrollText}
                title='Audit Logs'
                description='Review admin actions, outcomes, targets, and request fingerprints from the Admin Ops Ledger.'
                actionLabel='Open Logs'
              />
            </section>

            <AdminGlassPanel className='p-4 sm:p-5'>
              <div className='mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <h2 className='text-base font-semibold text-white'>Admin Users</h2>
                  <p className='mt-1 text-sm text-slate-400'>
                    Latest rows from the Admin Ops Ledger.
                  </p>
                </div>
                <span className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300'>
                  {adminUsers.length} shown
                </span>
              </div>

              {adminUsers.length ? (
                <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                  {adminUsers.map((adminUser) => (
                    <AdminUserCard key={adminUser.id} adminUser={adminUser} />
                  ))}
                </div>
              ) : (
                <p className='rounded-lg border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-sm text-amber-100'>
                  Admin ops ledger users could not be loaded.
                </p>
              )}
            </AdminGlassPanel>
          </div>
        </main>
      </CometsContainer>
    </DefaultPageWrapper>
  );
}

function AdminOpsLinkCard({
  href,
  eyebrow,
  icon: Icon,
  title,
  description,
  actionLabel,
  children,
}: {
  href: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={getAdminGlassPanelClassName('group p-4 sm:p-5', {
        interactive: true,
      })}
    >
      <div className='flex h-full flex-col gap-4'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0'>
            <div className='mb-3 inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100'>
              <Icon size={14} />
              {eyebrow}
            </div>
            <h2 className='text-base font-semibold text-white'>{title}</h2>
            <p className='mt-1 max-w-3xl text-sm leading-6 text-slate-400'>{description}</p>
          </div>
          <span className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-cyan-100 transition group-hover:border-cyan-300/30'>
            {actionLabel}
          </span>
        </div>
        {children ? <div className='grid gap-3 sm:grid-cols-2'>{children}</div> : null}
      </div>
    </Link>
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

function AdminUserCard({ adminUser }: { adminUser: AdminUserSummary }) {
  const statusClass =
    adminUser.status === 'active'
      ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
      : 'border-slate-300/15 bg-white/[0.04] text-slate-300';

  return (
    <article className={getAdminGlassPanelClassName('min-h-[150px] p-4')}>
      <div className='flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3'>
        <div className='min-w-0'>
          <h3 className='truncate text-sm font-semibold text-white'>
            {adminUser.email ?? adminUser.codexUserId}
          </h3>
          <p className='mt-1 truncate text-xs text-slate-500'>{adminUser.codexUserId}</p>
        </div>
        <span
          className={`shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-xs ${statusClass}`}
        >
          {adminUser.status}
        </span>
      </div>

      <div className='mt-4 flex flex-wrap gap-2'>
        <span className='whitespace-nowrap rounded-md border border-cyan-300/15 bg-cyan-300/10 px-2 py-1 text-[11px] text-cyan-100'>
          {adminUser.role ?? 'unknown'}
        </span>
        {adminUser.scopes.slice(0, 4).map((scope) => (
          <span
            key={scope}
            className='whitespace-nowrap rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-300'
          >
            {scope}
          </span>
        ))}
        {adminUser.scopes.length > 4 ? (
          <span className='whitespace-nowrap rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-400'>
            +{adminUser.scopes.length - 4}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function getNotificationRecipientSummary(
  groups: Awaited<ReturnType<typeof listAdminNotificationRecipientGroupsForDashboard>>,
) {
  const notificationGroups = groups.filter(
    (group) => group.key !== ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  );
  const globalDefaults = groups.find(
    (group) => group.key === ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  );

  return {
    defaultRecipientCount: globalDefaults?.recipientEmails.length ?? 0,
    enabledGroups: notificationGroups.filter((group) => group.enabled).length,
    groupCount: notificationGroups.length,
  };
}
