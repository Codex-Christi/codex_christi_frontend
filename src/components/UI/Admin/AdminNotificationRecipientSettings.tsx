'use client';

import { useActionState, useMemo, useState, type ReactNode } from 'react';
import {
  BellRing,
  CheckCircle2,
  CircleOff,
  Loader2,
  Mail,
  MailCheck,
  MailPlus,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react';
import {
  saveAdminNotificationRecipientGroupAction,
  type AdminNotificationRecipientGroupActionState,
} from '@/app/admin/admin-ops/actions';
import AdminGlassPanel, {
  adminFieldClass,
  adminInsetSurfaceClass,
} from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/primitives/alert-dialog';
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

const ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY = 'all_notification_groups';

type AdminRecipientOption = {
  id: string;
  label: string;
  email: string;
  role: string | null;
  status: string;
};

type ActiveRecipient = {
  email: string;
  label: string;
  source: 'custom' | 'global' | 'master';
  removable: boolean;
};

type AdminNotificationRecipientSettingsProps = {
  groups: AdminNotificationRecipientGroupSummary[];
  adminOptions: AdminRecipientOption[];
};

const initialState: AdminNotificationRecipientGroupActionState = {
  error: null,
  success: null,
};

export default function AdminNotificationRecipientSettings({
  groups,
  adminOptions,
}: AdminNotificationRecipientSettingsProps) {
  const globalDefaultGroup = groups.find(
    (group) => group.key === ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  );
  const notificationGroups = groups.filter(
    (group) => group.key !== ADMIN_NOTIFICATION_GLOBAL_DEFAULTS_KEY,
  );
  const globalDefaultEmails = globalDefaultGroup?.recipientEmails ?? [];
  const uniqueCustomRecipientCount = new Set(groups.flatMap((group) => group.recipientEmails)).size;
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
          <MetricTile label='Custom Emails' value={`${uniqueCustomRecipientCount}`} />
        </div>
      </div>

      <div className='p-4 sm:p-5'>
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

function RecipientGroupRow({
  group,
  adminOptions,
  globalEmails,
  mode,
}: {
  group: AdminNotificationRecipientGroupSummary;
  adminOptions: AdminRecipientOption[];
  globalEmails: string[];
  mode: 'global' | 'group';
}) {
  const isGlobalDefaults = mode === 'global';
  const [state, formAction, pending] = useActionState(
    saveAdminNotificationRecipientGroupAction,
    initialState,
  );
  const [emails, setEmails] = useState(group.recipientEmails);
  const [draft, setDraft] = useState('');
  const [enabled, setEnabled] = useState(isGlobalDefaults ? true : group.enabled);
  const [includeMasterAdmins, setIncludeMasterAdmins] = useState(
    isGlobalDefaults ? false : group.includeMasterAdmins,
  );
  const activeRecipients = useMemo(
    () =>
      resolveActiveRecipients({
        adminOptions,
        emails,
        enabled,
        globalEmails,
        includeMasterAdmins,
        mode,
      }),
    [adminOptions, emails, enabled, globalEmails, includeMasterAdmins, mode],
  );
  const customRecipientSet = useMemo(
    () => new Set([...emails, ...globalEmails].map((email) => email.toLowerCase())),
    [emails, globalEmails],
  );
  const masterAdminCount = adminOptions.filter((admin) => admin.role === 'master_admin').length;
  const suggestions = adminOptions.filter(
    (admin) =>
      admin.email &&
      !customRecipientSet.has(admin.email.toLowerCase()) &&
      (!draft.trim() ||
        admin.email.toLowerCase().includes(draft.trim().toLowerCase()) ||
        admin.label.toLowerCase().includes(draft.trim().toLowerCase())),
  );

  const addEmail = (value: string) => {
    const email = normalizeEmail(value);
    if (!email || customRecipientSet.has(email) || !isValidEmail(email)) return;

    setEmails((current) => [...current, email]);
    setDraft('');
  };

  const removeEmail = (email: string) => {
    setEmails((current) => current.filter((candidate) => candidate !== email));
  };

  return (
    <Dialog>
      <article className='grid gap-3 py-3 first:pt-0 last:pb-0 lg:grid-cols-[minmax(260px,1.15fr)_minmax(240px,0.85fr)_auto] lg:items-center'>
        <div className='min-w-0'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:block'>
            <div className='min-w-0'>
              <h3 className='text-sm font-semibold text-white'>{group.label}</h3>
              <p className='mt-1 max-w-2xl text-xs leading-5 text-slate-400'>{group.description}</p>
            </div>
          </div>

          <div className='mt-4 flex flex-wrap gap-2'>
            {isGlobalDefaults ? (
              <>
                <CountChip icon={MailCheck} label='Default' value={`${emails.length}`} />
                <CountChip icon={Mail} label='Inherited' value={`${activeRecipients.length}`} />
              </>
            ) : (
              <>
                <CountChip icon={MailCheck} label='Active' value={`${activeRecipients.length}`} />
                <CountChip icon={Mail} label='Custom' value={`${emails.length}`} />
                <CountChip
                  icon={ShieldCheck}
                  label='Master'
                  value={includeMasterAdmins ? `${masterAdminCount}` : 'Off'}
                />
              </>
            )}
          </div>
        </div>

        <CurrentRecipientList
          activeRecipients={activeRecipients}
          emptyLabel={isGlobalDefaults ? 'No default recipients' : 'No active recipients'}
          enabled={enabled}
          title={isGlobalDefaults ? 'Default Recipients' : 'Current Recipients'}
        />

        <div className='flex shrink-0 flex-wrap items-center gap-2 lg:justify-end'>
          {isGlobalDefaults ? (
            <span className='inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs text-amber-100'>
              <MailCheck size={12} />
              all groups
            </span>
          ) : (
            <StatusBadge enabled={enabled} />
          )}
          <DialogTrigger asChild>
            <button
              type='button'
              className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15'
            >
              <Pencil size={14} />
              Manage
            </button>
          </DialogTrigger>
        </div>
      </article>

      <DialogContent className='max-h-[88dvh] w-[min(94vw,780px)] overflow-y-auto rounded-lg border border-white/10 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'>
        <DialogHeader>
          <DialogTitle className='text-white'>{group.label}</DialogTitle>
          <DialogDescription className='text-slate-400'>{group.description}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className='mt-2 space-y-4'>
          <input type='hidden' name='key' value={group.key} />
          {isGlobalDefaults ? <input type='hidden' name='enabled' value='true' /> : null}
          {emails.map((email) => (
            <input key={email} type='hidden' name='recipientEmails' value={email} />
          ))}

          {isGlobalDefaults ? (
            <div className='rounded-lg border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100'>
              Emails saved here are inherited by every notification group. Remove them here to stop
              global inheritance.
            </div>
          ) : (
            <div className='grid gap-3 sm:grid-cols-2'>
              <ToggleRow
                title='Group enabled'
                description={
                  enabled ? 'Emails are routed for this group.' : 'No emails are routed.'
                }
                checked={enabled}
                name='enabled'
                onChange={setEnabled}
              />
              <ToggleRow
                title='Master admins'
                description={
                  includeMasterAdmins
                    ? `${masterAdminCount} active master admin${masterAdminCount === 1 ? '' : 's'} included.`
                    : 'Master admins are not inherited.'
                }
                checked={includeMasterAdmins}
                name='includeMasterAdmins'
                onChange={setIncludeMasterAdmins}
              />
            </div>
          )}

          <section className={cn(adminInsetSurfaceClass, 'p-3')}>
            <SectionHeader
              icon={UsersRound}
              title={isGlobalDefaults ? 'Default recipients' : 'Active recipients'}
              detail={`${activeRecipients.length}`}
            />
            <div className='mt-3 grid gap-2'>
              {activeRecipients.length ? (
                activeRecipients.map((recipient) => (
                  <RecipientRow
                    key={`${recipient.source}-${recipient.email}`}
                    recipient={recipient}
                    onRemove={() => removeEmail(recipient.email)}
                  />
                ))
              ) : (
                <EmptyRecipientState />
              )}
            </div>
          </section>

          <section className={cn(adminInsetSurfaceClass, 'p-3')}>
            <SectionHeader
              icon={MailPlus}
              title={isGlobalDefaults ? 'Default emails' : 'Custom recipients'}
              detail={`${emails.length}`}
            />
            <div className='mt-3 flex gap-2'>
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    addEmail(draft);
                  }
                }}
                type='text'
                inputMode='email'
                placeholder='name@example.com'
                className={cn(adminFieldClass, 'min-w-0 flex-1')}
              />
              <button
                type='button'
                onClick={() => addEmail(draft)}
                className='inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
              >
                <MailPlus size={16} />
                Add
              </button>
            </div>

            {suggestions.length ? (
              <div className='mt-3 flex flex-wrap gap-2'>
                {suggestions.slice(0, 6).map((admin) => (
                  <button
                    key={admin.id}
                    type='button'
                    onClick={() => addEmail(admin.email)}
                    className='inline-flex max-w-full items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-left text-xs text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-100'
                  >
                    <span className='truncate'>{admin.label}</span>
                    <span className='truncate text-slate-500'>{admin.email}</span>
                  </button>
                ))}
              </div>
            ) : null}
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
            {pending ? 'Saving...' : 'Save Routing'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2'>
      <p className='text-[11px] uppercase tracking-[0.14em] text-slate-500'>{label}</p>
      <p className='mt-1 text-lg font-semibold text-white'>{value}</p>
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <span className='inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300/15 bg-white/[0.04] px-2 py-1 text-xs text-slate-300'>
        <CircleOff size={12} />
        route off
      </span>
    );
  }

  return (
    <span className='inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100'>
      <CheckCircle2 size={12} />
      route on
    </span>
  );
}

function CountChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <span className='inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.07] bg-slate-950/25 px-2.5 text-xs text-slate-300'>
      <Icon size={13} className='text-slate-500' />
      <span className='uppercase tracking-[0.12em] text-slate-500'>{label}</span>
      <strong className='font-semibold text-white'>{value}</strong>
    </span>
  );
}

function CurrentRecipientList({
  activeRecipients,
  emptyLabel,
  enabled,
  title,
}: {
  activeRecipients: ActiveRecipient[];
  emptyLabel: string;
  enabled: boolean;
  title: string;
}) {
  const previewRecipients = activeRecipients.slice(0, 2);
  const hiddenRecipientCount = Math.max(activeRecipients.length - previewRecipients.length, 0);

  return (
    <section className='min-w-0'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='flex min-w-0 shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500'>
          <UsersRound size={14} className='shrink-0 text-cyan-100' />
          <span className='truncate'>{title}</span>
        </div>
        <span className='shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-slate-300'>
          {activeRecipients.length}
        </span>

        {activeRecipients.length ? (
          <>
            {previewRecipients.map((recipient) => (
              <span
                key={`${recipient.source}-${recipient.email}`}
                className='inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-xs text-slate-200'
              >
                {recipient.source === 'master' ? (
                  <ShieldCheck size={12} className='shrink-0 text-emerald-200' />
                ) : (
                  <Mail size={12} className='shrink-0 text-cyan-200' />
                )}
                <span className='truncate'>{recipient.email}</span>
                <span
                  className={cn(
                    'shrink-0 rounded border px-1.5 py-0.5 text-[10px]',
                    recipient.source === 'master'
                      ? 'border-emerald-300/15 bg-emerald-300/10 text-emerald-100'
                      : recipient.source === 'global'
                        ? 'border-amber-300/15 bg-amber-300/10 text-amber-100'
                        : 'border-cyan-300/15 bg-cyan-300/10 text-cyan-100',
                  )}
                >
                  {recipient.source === 'master'
                    ? 'Master'
                    : recipient.source === 'global'
                      ? 'Global'
                      : 'Custom'}
                </span>
              </span>
            ))}
            {hiddenRecipientCount ? (
              <span className='inline-flex items-center rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-xs text-slate-400'>
                +{hiddenRecipientCount}
              </span>
            ) : null}
          </>
        ) : (
          <span className='inline-flex min-h-7 items-center gap-2 rounded-md border border-dashed border-white/10 bg-slate-950/20 px-2 text-xs text-slate-500'>
            <CircleOff size={14} />
            {enabled ? emptyLabel : 'Group disabled'}
          </span>
        )}
      </div>
    </section>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  name,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  name: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        adminInsetSurfaceClass,
        'flex min-h-[74px] cursor-pointer items-center gap-3 p-3 transition hover:border-white/10 hover:bg-white/[0.05]',
      )}
    >
      <input
        type='checkbox'
        name={name}
        value='true'
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className='h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300'
      />
      <span className='min-w-0'>
        <span className='block text-sm font-semibold text-white'>{title}</span>
        <span className='mt-1 block text-xs leading-5 text-slate-400'>{description}</span>
      </span>
    </label>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Mail;
  title: string;
  detail: string;
}) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='inline-flex items-center gap-2 text-sm font-semibold text-white'>
        <Icon size={15} className='text-cyan-100' />
        {title}
      </div>
      <span className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300'>
        {detail}
      </span>
    </div>
  );
}

function RecipientRow({
  recipient,
  onRemove,
}: {
  recipient: ActiveRecipient;
  onRemove: () => void;
}) {
  const isMaster = recipient.source === 'master';
  const isGlobal = recipient.source === 'global';

  return (
    <div className='flex min-h-11 items-center justify-between gap-3 rounded-lg border border-white/[0.055] bg-slate-950/30 px-3 py-2'>
      <div className='flex min-w-0 items-center gap-3'>
        <span
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
            isMaster
              ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
              : isGlobal
                ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
          )}
        >
          {isMaster ? <ShieldCheck size={15} /> : <Mail size={15} />}
        </span>
        <div className='min-w-0'>
          <p className='truncate text-sm text-white'>{recipient.email}</p>
          <p className='truncate text-xs text-slate-500'>{recipient.label}</p>
        </div>
      </div>

      {recipient.removable ? (
        <ConfirmLocalRecipientRemoval recipientEmail={recipient.email} onConfirm={onRemove} />
      ) : (
        <span
          className={cn(
            'shrink-0 rounded-md border px-2 py-1 text-xs',
            isGlobal
              ? 'border-amber-300/15 bg-amber-300/10 text-amber-100'
              : 'border-emerald-300/15 bg-emerald-300/10 text-emerald-100',
          )}
        >
          {isGlobal ? 'Global' : 'Master'}
        </span>
      )}
    </div>
  );
}

function ConfirmLocalRecipientRemoval({
  recipientEmail,
  onConfirm,
}: {
  recipientEmail: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type='button'
          className='inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-300/20 bg-rose-300/10 px-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15'
        >
          <Trash2 size={13} />
          Remove
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className='w-[min(92vw,440px)] rounded-lg border border-white/10 bg-slate-950/95 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-white'>Remove notification recipient?</AlertDialogTitle>
          <AlertDialogDescription className='break-words text-slate-400'>
            This removes {recipientEmail} from the pending recipient list. Save routing to persist
            the change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className='border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white'>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            type='button'
            onClick={onConfirm}
            className='bg-rose-400 text-slate-950 hover:bg-rose-300'
          >
            Confirm Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EmptyRecipientState() {
  return (
    <div className='flex min-h-16 items-center gap-2 rounded-lg border border-dashed border-white/10 bg-slate-950/20 px-3 text-sm text-slate-500'>
      <CircleOff size={16} />
      None
    </div>
  );
}

function Message({ tone, children }: { tone: 'rose' | 'emerald'; children: ReactNode }) {
  const toneClass = {
    rose: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  }[tone];

  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs leading-5',
        toneClass,
      )}
    >
      {children}
    </p>
  );
}

function resolveActiveRecipients({
  adminOptions,
  emails,
  enabled,
  globalEmails,
  includeMasterAdmins,
  mode,
}: {
  adminOptions: AdminRecipientOption[];
  emails: string[];
  enabled: boolean;
  globalEmails: string[];
  includeMasterAdmins: boolean;
  mode: 'global' | 'group';
}) {
  if (!enabled) return [];

  const recipients = new Map<string, ActiveRecipient>();

  if (mode === 'group') {
    for (const email of globalEmails) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) continue;
      recipients.set(normalizedEmail, {
        email: normalizedEmail,
        label: 'Inherited from all notification groups',
        source: 'global',
        removable: false,
      });
    }
  }

  for (const email of emails) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) continue;
    if (recipients.has(normalizedEmail)) continue;

    recipients.set(normalizedEmail, {
      email: normalizedEmail,
      label: mode === 'global' ? 'All notification groups' : 'Custom recipient',
      source: mode === 'global' ? 'global' : 'custom',
      removable: true,
    });
  }

  if (includeMasterAdmins && mode === 'group') {
    for (const admin of adminOptions) {
      const normalizedEmail = normalizeEmail(admin.email);
      if (!normalizedEmail || admin.role !== 'master_admin') continue;
      if (recipients.has(normalizedEmail)) continue;

      recipients.set(normalizedEmail, {
        email: normalizedEmail,
        label: admin.label,
        source: 'master',
        removable: false,
      });
    }
  }

  return [...recipients.values()].sort((left, right) => left.email.localeCompare(right.email));
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase().replace(/,$/, '');
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
