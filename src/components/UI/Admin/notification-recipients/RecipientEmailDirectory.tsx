'use client';

import { useActionState, useMemo, useState } from 'react';
import {
  CheckCircle2,
  LockKeyhole,
  Loader2,
  Mail,
  MailCheck,
  Save,
  Search,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import {
  saveAdminNotificationRecipientEmailPermissionsAction,
  type AdminNotificationRecipientEmailPermissionsActionState,
} from '@/app/admin/admin-ops/actions';
import {
  adminFieldClass,
  adminInsetSurfaceClass,
} from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/UI/primitives/dialog';
import type { AdminNotificationRecipientGroupSummary } from '@/lib/admin/admin-notification-recipients';
import { cn } from '@/lib/utils';
import {
  EmptyRecipientState,
  Message,
  MetricTile,
  RouteChip,
  SectionHeader,
} from './RecipientPrimitives';
import {
  buildRecipientDirectoryEntries,
  createRecipientDirectoryEntry,
  getNotificationGroups,
  getRecipientDirectorySearchText,
  isValidEmail,
  normalizeEmail,
} from './recipientUtils';
import type { AdminRecipientOption, RecipientDirectoryEntry } from './types';

const initialEmailPermissionsState: AdminNotificationRecipientEmailPermissionsActionState = {
  error: null,
  success: null,
};

export default function RecipientEmailDirectory({
  groups,
  adminOptions,
}: {
  groups: AdminNotificationRecipientGroupSummary[];
  adminOptions: AdminRecipientOption[];
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const entries = useMemo(
    () => buildRecipientDirectoryEntries({ groups, adminOptions }),
    [adminOptions, groups],
  );
  const entryEmailSet = useMemo(
    () => new Set(entries.map((entry) => entry.email.toLowerCase())),
    [entries],
  );
  const filteredEntries = entries.filter((entry) => {
    if (!normalizedQuery) return true;
    return getRecipientDirectorySearchText(entry, groups).includes(normalizedQuery);
  });
  const adminCandidates = adminOptions
    .filter((admin) => admin.email && !entryEmailSet.has(admin.email.toLowerCase()))
    .filter(
      (admin) =>
        normalizedQuery &&
        (admin.email.toLowerCase().includes(normalizedQuery) ||
          admin.label.toLowerCase().includes(normalizedQuery)),
    )
    .slice(0, 5);
  const normalizedQueryEmail = normalizeEmail(normalizedQuery);
  const canConfigureTypedEmail =
    isValidEmail(normalizedQueryEmail) && !entryEmailSet.has(normalizedQueryEmail);
  const typedEmailMatchesAdminCandidate = adminCandidates.some(
    (admin) => normalizeEmail(admin.email) === normalizedQueryEmail,
  );

  return (
    <section className={cn(adminInsetSurfaceClass, 'mb-5 p-3 sm:p-4')}>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
        <div className='min-w-0'>
          <div className='inline-flex items-center gap-2 text-sm font-semibold text-white'>
            <Search size={15} className='text-cyan-100' />
            Recipient directory
          </div>
          <p className='mt-1 text-xs leading-5 text-slate-400'>
            Search an email, see its current notification routes, then edit its permissions from one
            place. Master-admin inherited routes are locked.
          </p>
        </div>
        <div className='grid grid-cols-2 gap-2 sm:min-w-[260px]'>
          <MetricTile label='Visible Emails' value={`${entries.length}`} />
          <MetricTile
            label='Locked Master'
            value={`${entries.filter((entry) => entry.isMasterAdmin).length}`}
          />
        </div>
      </div>

      <div className='mt-4'>
        <div className='relative'>
          <Search
            size={16}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500'
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type='search'
            inputMode='email'
            placeholder='Search recipient email or admin name'
            className={cn(adminFieldClass, 'h-11 w-full pl-9')}
          />
        </div>

        <div className='mt-3 grid max-h-[420px] gap-2 overflow-y-auto pr-1'>
          {filteredEntries.map((entry) => (
            <RecipientDirectoryRow
              key={entry.email}
              entry={entry}
              groups={groups}
              actionLabel='Edit permissions'
            />
          ))}

          {adminCandidates.map((admin) => (
            <RecipientDirectoryRow
              key={`candidate-${admin.email}`}
              entry={createRecipientDirectoryEntry({
                email: admin.email,
                label: admin.label,
                isMasterAdmin: admin.role === 'master_admin',
              })}
              groups={groups}
              actionLabel='Configure'
            />
          ))}

          {canConfigureTypedEmail && !typedEmailMatchesAdminCandidate ? (
            <RecipientDirectoryRow
              key={`typed-${normalizedQueryEmail}`}
              entry={createRecipientDirectoryEntry({
                email: normalizedQueryEmail,
                label: 'New custom recipient',
                isMasterAdmin: false,
              })}
              groups={groups}
              actionLabel='Configure'
            />
          ) : null}

          {!filteredEntries.length && !adminCandidates.length && !canConfigureTypedEmail ? (
            <EmptyRecipientState label='No matching notification recipients' />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function RecipientDirectoryRow({
  entry,
  groups,
  actionLabel,
}: {
  entry: RecipientDirectoryEntry;
  groups: AdminNotificationRecipientGroupSummary[];
  actionLabel: string;
}) {
  const activeCount = entry.activeGroupKeys.length;
  const configuredCount = entry.inGlobalDefaults
    ? getNotificationGroups(groups).length
    : entry.directGroupKeys.length;

  return (
    <div className='flex flex-col gap-3 rounded-lg border border-white/[0.055] bg-slate-950/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex min-w-0 items-start gap-3'>
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg border',
            entry.isMasterAdmin
              ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
              : entry.inGlobalDefaults
                ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
          )}
        >
          {entry.isMasterAdmin ? <ShieldCheck size={16} /> : <Mail size={16} />}
        </span>
        <div className='min-w-0'>
          <p className='break-all text-sm font-semibold text-white'>{entry.email}</p>
          <p className='mt-0.5 truncate text-xs text-slate-500'>{entry.label}</p>
          <div className='mt-2 flex flex-wrap gap-1.5'>
            {entry.isMasterAdmin ? (
              <RouteChip tone='emerald' label='Master admin' />
            ) : entry.inGlobalDefaults ? (
              <RouteChip tone='amber' label='All groups' />
            ) : configuredCount ? (
              <RouteChip tone='cyan' label={`${configuredCount} configured`} />
            ) : (
              <RouteChip tone='slate' label='Not routed' />
            )}
            <RouteChip tone={activeCount ? 'emerald' : 'slate'} label={`${activeCount} active`} />
          </div>
        </div>
      </div>

      <div className='flex shrink-0 items-center gap-2 sm:justify-end'>
        {entry.isMasterAdmin ? (
          <span className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 text-xs font-semibold text-emerald-100'>
            <LockKeyhole size={14} />
            Locked
          </span>
        ) : (
          <EmailPermissionsDialog entry={entry} groups={groups} actionLabel={actionLabel} />
        )}
      </div>
    </div>
  );
}

function EmailPermissionsDialog({
  entry,
  groups,
  actionLabel,
}: {
  entry: RecipientDirectoryEntry;
  groups: AdminNotificationRecipientGroupSummary[];
  actionLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    saveAdminNotificationRecipientEmailPermissionsAction,
    initialEmailPermissionsState,
  );
  const notificationGroups = getNotificationGroups(groups);
  const [includeGlobalDefault, setIncludeGlobalDefault] = useState(entry.inGlobalDefaults);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState(entry.directGroupKeys);
  const selectedGroupKeySet = useMemo(() => new Set(selectedGroupKeys), [selectedGroupKeys]);

  const toggleGroupKey = (groupKey: string, checked: boolean) => {
    setSelectedGroupKeys((current) => {
      const next = new Set(current);
      if (checked) next.add(groupKey);
      else next.delete(groupKey);
      return [...next];
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type='button'
          className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15'
        >
          <Settings2 size={14} />
          {actionLabel}
        </button>
      </DialogTrigger>

      <DialogContent className='max-h-[88dvh] w-[min(94vw,780px)] overflow-y-auto rounded-lg border border-white/10 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'>
        <DialogHeader>
          <DialogTitle className='text-white'>Edit notification permissions</DialogTitle>
          <DialogDescription className='break-words text-slate-400'>
            {entry.email}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className='mt-2 space-y-4'>
          <input type='hidden' name='email' value={entry.email} />
          <input
            type='hidden'
            name='includeGlobalDefault'
            value={includeGlobalDefault ? 'true' : 'false'}
          />
          {!includeGlobalDefault
            ? selectedGroupKeys.map((groupKey) => (
                <input key={groupKey} type='hidden' name='groupKeys' value={groupKey} />
              ))
            : null}

          <label
            className={cn(
              adminInsetSurfaceClass,
              'flex cursor-pointer items-start gap-3 p-3 transition hover:border-amber-300/20 hover:bg-amber-300/10',
            )}
          >
            <input
              type='checkbox'
              checked={includeGlobalDefault}
              onChange={(event) => setIncludeGlobalDefault(event.target.checked)}
              className='mt-1 h-4 w-4 rounded border-white/20 bg-slate-950 text-amber-300'
            />
            <span className='min-w-0'>
              <span className='block text-sm font-semibold text-white'>
                Register for all notification groups
              </span>
              <span className='mt-1 block text-xs leading-5 text-slate-400'>
                Saves this email in the global defaults list. It will inherit every current route
                and future notification groups.
              </span>
            </span>
          </label>

          <section className={cn(adminInsetSurfaceClass, 'p-3')}>
            <SectionHeader
              icon={MailCheck}
              title='Route permissions'
              detail={includeGlobalDefault ? 'All groups' : `${selectedGroupKeys.length}`}
            />

            <div className='mt-3 grid gap-2'>
              {notificationGroups.map((group) => {
                const checked = selectedGroupKeySet.has(group.key);
                const inheritedByMaster = entry.inheritedMasterGroupKeys.includes(group.key);

                return (
                  <label
                    key={group.key}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-lg border border-white/[0.055] bg-slate-950/30 px-3 py-2 transition',
                      includeGlobalDefault
                        ? 'cursor-not-allowed opacity-75'
                        : 'cursor-pointer hover:border-cyan-300/20 hover:bg-cyan-300/10',
                    )}
                  >
                    <input
                      type='checkbox'
                      checked={!includeGlobalDefault && checked}
                      disabled={includeGlobalDefault || inheritedByMaster}
                      onChange={(event) => toggleGroupKey(group.key, event.target.checked)}
                      className='h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300 disabled:opacity-50'
                    />
                    <span className='min-w-0 flex-1'>
                      <span className='block text-sm font-semibold text-white'>{group.label}</span>
                      <span className='mt-0.5 block text-xs leading-5 text-slate-500'>
                        {includeGlobalDefault
                          ? 'Inherited from all notification groups.'
                          : inheritedByMaster
                            ? 'Inherited from master-admin routing.'
                            : group.description}
                      </span>
                    </span>
                    <span className='flex shrink-0 flex-wrap justify-end gap-1.5'>
                      <RouteChip
                        tone={group.enabled ? 'emerald' : 'slate'}
                        label={group.enabled ? 'route on' : 'route off'}
                      />
                      {includeGlobalDefault ? <RouteChip tone='amber' label='global' /> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {state.error ? <Message tone='rose'>{state.error}</Message> : null}
          {state.success ? (
            <Message tone='emerald'>
              <CheckCircle2 size={14} />
              {state.success}
            </Message>
          ) : null}

          <button
            type='submit'
            disabled={pending}
            className='inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {pending ? <Loader2 size={16} className='animate-spin' /> : <Save size={16} />}
            {pending ? 'Saving...' : 'Save Email Permissions'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
