'use client';

import { useActionState, useMemo, useState } from 'react';
import { BellRing, CheckCircle2, Loader2, MailPlus, Save, X } from 'lucide-react';
import {
  saveAdminNotificationRecipientGroupAction,
  type AdminNotificationRecipientGroupActionState,
} from '@/app/admin/admin-ops/actions';
import type { AdminNotificationRecipientGroupSummary } from '@/lib/admin/admin-notification-recipients';
import { cn } from '@/lib/utils';

type AdminRecipientOption = {
  id: string;
  label: string;
  email: string;
  status: string;
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
  return (
    <section className='rounded-lg border border-white/10 bg-slate-950/72 p-4 supports-[backdrop-filter]:backdrop-blur-xl sm:p-5'>
      <div className='mb-4 flex items-center justify-between gap-3'>
        <div>
          <h2 className='text-base font-semibold text-white'>Notification Recipients</h2>
          <p className='mt-1 max-w-3xl text-sm leading-6 text-slate-400'>
            Choose who receives operational alerts. Master admins can add active admins or custom
            external email addresses.
          </p>
        </div>
        <span className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-amber-300/20 bg-amber-300/10 text-amber-100'>
          <BellRing size={20} />
        </span>
      </div>

      <div className='grid gap-4 xl:grid-cols-2'>
        {groups.map((group) => (
          <RecipientGroupForm key={group.key} group={group} adminOptions={adminOptions} />
        ))}
      </div>
    </section>
  );
}

function RecipientGroupForm({
  group,
  adminOptions,
}: {
  group: AdminNotificationRecipientGroupSummary;
  adminOptions: AdminRecipientOption[];
}) {
  const [state, formAction, pending] = useActionState(
    saveAdminNotificationRecipientGroupAction,
    initialState,
  );
  const [emails, setEmails] = useState(group.recipientEmails);
  const [draft, setDraft] = useState('');
  const [enabled, setEnabled] = useState(group.enabled);
  const [includeMasterAdmins, setIncludeMasterAdmins] = useState(group.includeMasterAdmins);
  const normalizedEmailSet = useMemo(
    () => new Set(emails.map((email) => email.toLowerCase())),
    [emails],
  );
  const suggestions = adminOptions.filter(
    (admin) =>
      admin.email &&
      !normalizedEmailSet.has(admin.email.toLowerCase()) &&
      (!draft.trim() ||
        admin.email.toLowerCase().includes(draft.trim().toLowerCase()) ||
        admin.label.toLowerCase().includes(draft.trim().toLowerCase())),
  );

  const addEmail = (value: string) => {
    const email = value.trim().toLowerCase().replace(/,$/, '');
    if (!email || normalizedEmailSet.has(email) || !isValidEmail(email)) return;

    setEmails((current) => [...current, email]);
    setDraft('');
  };

  const removeEmail = (email: string) => {
    setEmails((current) => current.filter((candidate) => candidate !== email));
  };

  return (
    <form action={formAction} className='rounded-lg border border-white/10 bg-white/[0.03] p-4'>
      <input type='hidden' name='key' value={group.key} />
      {emails.map((email) => (
        <input key={email} type='hidden' name='recipientEmails' value={email} />
      ))}

      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0'>
          <h3 className='text-sm font-semibold text-white'>{group.label}</h3>
          <p className='mt-1 text-xs leading-5 text-slate-400'>{group.description}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-md border px-2 py-1 text-xs',
            enabled
              ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
              : 'border-slate-300/15 bg-white/[0.04] text-slate-300',
          )}
        >
          {enabled ? 'enabled' : 'disabled'}
        </span>
      </div>

      <div className='mt-4 grid gap-3'>
        <label className='flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200'>
          <input
            type='checkbox'
            name='enabled'
            value='true'
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className='h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300'
          />
          Send this notification type
        </label>

        <label className='flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/40 px-3 text-xs text-slate-200'>
          <input
            type='checkbox'
            name='includeMasterAdmins'
            value='true'
            checked={includeMasterAdmins}
            onChange={(event) => setIncludeMasterAdmins(event.target.checked)}
            className='h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300'
          />
          Include active master admins
        </label>

        <div className='rounded-lg border border-white/10 bg-slate-950/55 p-3'>
          <div className='flex flex-wrap gap-2'>
            {emails.map((email) => (
              <span
                key={email}
                className='inline-flex max-w-full items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100'
              >
                <span className='truncate'>{email}</span>
                <button
                  type='button'
                  aria-label={`Remove ${email}`}
                  onClick={() => removeEmail(email)}
                  className='grid h-5 w-5 shrink-0 place-items-center rounded border border-cyan-300/20 text-cyan-100 transition hover:bg-cyan-300/10'
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          <div className='mt-3 flex gap-2'>
            <div className='relative min-w-0 flex-1'>
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
                placeholder='Add admin or custom email'
                className='h-10 w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40'
              />
            </div>
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
        </div>
      </div>

      {state.error ? (
        <p className='mt-3 rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100'>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className='mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs leading-5 text-emerald-100'>
          <CheckCircle2 size={14} />
          {state.success}
        </p>
      ) : null}

      <button
        type='submit'
        disabled={pending}
        className='mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {pending ? <Loader2 size={16} className='animate-spin' /> : <Save size={16} />}
        {pending ? 'Saving...' : 'Save Recipients'}
      </button>
    </form>
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
