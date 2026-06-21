import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BellRing, type LucideIcon, MailCheck, ShieldCheck } from 'lucide-react';
import { listAdminUsersForDashboard } from '@/lib/admin/admin-auth-ledger';
import { isMasterAdminRole } from '@/lib/admin/admin-config';
import AdminNotificationRecipientSettings from '@/components/UI/Admin/AdminNotificationRecipientSettings';
import AdminGlassPanel from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import {
  ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  listAdminNotificationRecipientGroupsForDashboard,
} from '@/lib/admin/admin-notification-recipients';
import { requireAdminPage } from '@/lib/admin/require-admin';

export const metadata: Metadata = {
  title: 'Notification Recipients | Codex Christi',
};

export default async function AdminNotificationRecipientsPage() {
  const admin = await requireAdminPage({
    returnPath: '/admin/admin-ops/notification-recipients',
  });

  if (!isMasterAdminRole(admin.role)) {
    notFound();
  }

  const [adminUsers, notificationRecipientGroups] = await Promise.all([
    listAdminUsersForDashboard().catch(() => []),
    listAdminNotificationRecipientGroupsForDashboard().catch(() => []),
  ]);
  const activeAdmins = adminUsers.filter((adminUser) => adminUser.status === 'active');
  const adminRecipientOptions = activeAdmins
    .filter((adminUser) => adminUser.email)
    .map((adminUser) => ({
      id: adminUser.id,
      label: adminUser.displayName ?? adminUser.email ?? adminUser.codexUserId,
      email: adminUser.email ?? '',
      role: adminUser.role,
      status: adminUser.status,
    }));
  const notificationSummary = getNotificationRecipientSummary(notificationRecipientGroups);

  return (
    <div className='mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:px-5'>
      <AdminGlassPanel className='p-5 sm:p-6'>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
          <div className='min-w-0 space-y-4'>
            <Link
              href='/admin/admin-ops'
              className='inline-flex items-center gap-2 text-sm font-medium text-cyan-100 transition hover:text-white'
            >
              <ArrowLeft size={16} />
              Admin Ops
            </Link>
            <div className='space-y-2'>
              <div className='inline-flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100'>
                <BellRing size={14} />
                Notification Routing
              </div>
              <h1 className='text-3xl font-semibold tracking-normal text-white sm:text-4xl'>
                Notification Recipients
              </h1>
              <p className='max-w-3xl text-sm leading-6 text-slate-300 sm:text-base'>
                Manage default operational recipients and per-group notification routing from one
                focused admin surface.
              </p>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-3 lg:min-w-[560px]'>
            <MetricPill
              label='Groups Enabled'
              value={`${notificationSummary.enabledGroups} of ${notificationSummary.groupCount}`}
              icon={MailCheck}
              tone='cyan'
            />
            <MetricPill
              label='Default Emails'
              value={`${notificationSummary.defaultRecipientCount}`}
              icon={BellRing}
              tone='amber'
            />
            <MetricPill
              label='Admin Sources'
              value={`${adminRecipientOptions.length}`}
              icon={ShieldCheck}
              tone='emerald'
            />
          </div>
        </div>
      </AdminGlassPanel>

      <AdminNotificationRecipientSettings
        groups={notificationRecipientGroups}
        adminOptions={adminRecipientOptions}
      />
    </div>
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
