'use client';

import { BellRing } from 'lucide-react';
import AdminGlassPanel from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import RecipientEmailDirectory from '@/components/UI/Admin/notification-recipients/RecipientEmailDirectory';
import RecipientGroupRow from '@/components/UI/Admin/notification-recipients/RecipientGroupRow';
import { MetricTile } from '@/components/UI/Admin/notification-recipients/RecipientPrimitives';
import { getNotificationGroups } from '@/components/UI/Admin/notification-recipients/recipientUtils';
import {
  ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  type AdminNotificationRecipientSettingsProps,
} from '@/components/UI/Admin/notification-recipients/types';

export default function AdminNotificationRecipientSettings({
  groups,
  adminOptions,
}: AdminNotificationRecipientSettingsProps) {
  const globalDefaultGroup = groups.find(
    (group) => group.key === ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  );
  const notificationGroups = getNotificationGroups(groups);
  const globalDefaultEmails = globalDefaultGroup?.recipientEmails ?? [];
  const uniqueRecipientCount = new Set(groups.flatMap((group) => group.recipientEmails)).size;
  const enabledGroupCount = notificationGroups.filter((group) => group.enabled).length;

  return (
    <AdminGlassPanel className='overflow-hidden'>
      <div className='flex flex-col gap-4 border-b border-white/10 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5'>
        <div className='min-w-0'>
          <div className='inline-flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-100'>
            <BellRing size={14} />
            Notification routing
          </div>
          <h2 className='mt-3 text-base font-semibold text-white'>Notification Recipients</h2>
          <p className='mt-1 max-w-3xl text-sm leading-6 text-slate-400'>
            Operational email groups used by payment, fulfillment, and admin workflows.
          </p>
        </div>

        <div className='grid min-w-[220px] grid-cols-2 gap-2'>
          <MetricTile
            label='Groups Enabled'
            value={`${enabledGroupCount} of ${notificationGroups.length}`}
          />
          <MetricTile label='Custom Emails' value={`${uniqueRecipientCount}`} />
        </div>
      </div>

      <div className='p-4 sm:p-5'>
        <RecipientEmailDirectory groups={groups} adminOptions={adminOptions} />

        <div className='divide-y divide-white/[0.07]'>
          {globalDefaultGroup ? (
            <RecipientGroupRow
              key={`${globalDefaultGroup.key}:${globalDefaultGroup.recipientEmails.join('|')}`}
              group={globalDefaultGroup}
              adminOptions={adminOptions}
              globalEmails={[]}
              mode='global'
            />
          ) : null}
          {notificationGroups.map((group) => (
            <RecipientGroupRow
              key={`${group.key}:${group.enabled}:${group.includeMasterAdmins}:${globalDefaultEmails.join('|')}:${group.recipientEmails.join('|')}`}
              group={group}
              adminOptions={adminOptions}
              globalEmails={globalDefaultEmails}
              mode='group'
            />
          ))}
        </div>
      </div>
    </AdminGlassPanel>
  );
}
