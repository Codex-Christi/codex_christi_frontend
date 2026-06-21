'use client';

import { useActionState, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  Mail,
  MailCheck,
  MailPlus,
  Pencil,
  Save,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import {
  saveAdminNotificationRecipientGroupAction,
  type AdminNotificationRecipientGroupActionState,
} from '@/app/admin/(dashboard)/admin-ops/actions';
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
  CountChip,
  CurrentRecipientList,
  EmptyRecipientState,
  Message,
  RecipientRow,
  SectionHeader,
  StatusBadge,
} from './RecipientPrimitives';
import { isValidEmail, normalizeEmail, resolveActiveRecipients } from './recipientUtils';
import type { AdminRecipientOption, RecipientGroupMode } from './types';

const initialState: AdminNotificationRecipientGroupActionState = {
  error: null,
  success: null,
};

export default function RecipientGroupRow({
  group,
  adminOptions,
  globalEmails,
  mode,
}: {
  group: AdminNotificationRecipientGroupSummary;
  adminOptions: AdminRecipientOption[];
  globalEmails: string[];
  mode: RecipientGroupMode;
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
  const masterAdminEmailSet = useMemo(
    () =>
      new Set(
        adminOptions
          .filter((admin) => admin.role === 'master_admin')
          .map((admin) => normalizeEmail(admin.email)),
      ),
    [adminOptions],
  );
  const masterAdminCount = adminOptions.filter((admin) => admin.role === 'master_admin').length;
  const draftEmail = normalizeEmail(draft);
  const hasDraft = Boolean(draft.trim());
  const draftMessage = getDraftMessage({
    customRecipientSet,
    draftEmail,
    hasDraft,
    masterAdminEmailSet,
  });
  const suggestions = adminOptions.filter(
    (admin) =>
      admin.email &&
      admin.role !== 'master_admin' &&
      !customRecipientSet.has(admin.email.toLowerCase()) &&
      (!draft.trim() ||
        admin.email.toLowerCase().includes(draft.trim().toLowerCase()) ||
        admin.label.toLowerCase().includes(draft.trim().toLowerCase())),
  );

  const addEmail = (value: string) => {
    const email = normalizeEmail(value);
    if (!email || customRecipientSet.has(email) || masterAdminEmailSet.has(email)) return;
    if (!isValidEmail(email)) return;

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

            {draftMessage ? (
              <p className='mt-2 text-xs leading-5 text-amber-100'>{draftMessage}</p>
            ) : null}

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
            disabled={pending || hasDraft}
            className='inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {pending ? <Loader2 size={16} className='animate-spin' /> : <Save size={16} />}
            {pending ? 'Saving...' : hasDraft ? 'Add or Clear Draft First' : 'Save Routing'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getDraftMessage({
  customRecipientSet,
  draftEmail,
  hasDraft,
  masterAdminEmailSet,
}: {
  customRecipientSet: Set<string>;
  draftEmail: string;
  hasDraft: boolean;
  masterAdminEmailSet: Set<string>;
}) {
  if (!hasDraft) return null;
  if (!isValidEmail(draftEmail)) return 'Enter a valid email address before adding it.';
  if (customRecipientSet.has(draftEmail)) return 'This draft email is already in the list.';
  if (masterAdminEmailSet.has(draftEmail)) {
    return 'Master admin emails are inherited and cannot be manually added here.';
  }

  return 'Click Add before saving. Draft text is not saved automatically.';
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
