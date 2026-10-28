'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { ArrowRight, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { adminFieldClass } from './dashboard/AdminGlassPanel';
import { adminTransferAcceptanceSchema } from '@/lib/formSchemas/admin-transfer';
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_PASSWORD_MAX_LENGTH,
} from '@/lib/formSchemas/admin-password';
import { postAdminAuth } from '@/lib/admin/admin-auth-client';
import { buildAdminTransferAcceptancePath, buildAdminUnlockPath } from '@/lib/admin/admin-paths';
import { logoutUserTo } from '@/actions/logout';

type FormState = { error: string | null; fields: Record<string, string>; accepted: boolean };
const initial: FormState = { error: null, fields: {}, accepted: false };

export default function AdminTransferAcceptanceForm({ challengeId }: { challengeId: string }) {
  const [state, action, pending] = useActionState(
    async (_previous: FormState, form: FormData): Promise<FormState> => {
      const parsed = adminTransferAcceptanceSchema.safeParse({
        challengeId,
        otp: form.get('otp'),
        password: form.get('password'),
        confirmation: form.get('confirmation'),
        acceptOwnership: form.get('acceptOwnership') === 'on',
      });
      if (!parsed.success)
        return {
          ...initial,
          fields: Object.fromEntries(
            parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
          ),
        };
      const result = await postAdminAuth('transfer/accept', parsed.data);
      return result.success ? { ...initial, accepted: true } : { ...initial, error: result.error };
    },
    initial,
  );

  if (state.accepted)
    return (
      <div className='space-y-4'>
        <p role='status' className='text-sm text-emerald-200'>
          Ownership accepted.
        </p>
        <Link
          href={buildAdminUnlockPath('/admin')}
          className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-medium text-slate-950'
        >
          Unlock Admin <ArrowRight size={16} />
        </Link>
      </div>
    );

  return (
    <div className='space-y-5'>
      <form action={action} className='space-y-4'>
        <fieldset disabled={pending} className='space-y-4 disabled:opacity-70'>
          {[
            {
              name: 'otp',
              label: 'Invitation code',
              type: 'text',
              autoComplete: 'one-time-code',
              min: 6,
              max: 6,
            },
            {
              name: 'password',
              label: 'Your new admin unlock password',
              type: 'password',
              autoComplete: 'new-password',
              min: ADMIN_PASSWORD_MIN_LENGTH,
              max: ADMIN_PASSWORD_MAX_LENGTH,
            },
            {
              name: 'confirmation',
              label: 'Confirm unlock password',
              type: 'password',
              autoComplete: 'new-password',
              min: ADMIN_PASSWORD_MIN_LENGTH,
              max: ADMIN_PASSWORD_MAX_LENGTH,
            },
          ].map((field) => (
            <div key={field.name} className='grid gap-2'>
              <label
                htmlFor={`transfer-${field.name}`}
                className='text-sm font-medium text-slate-200'
              >
                {field.label}
              </label>
              <input
                id={`transfer-${field.name}`}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                minLength={field.min}
                maxLength={field.max}
                required
                className={adminFieldClass}
                inputMode={field.name === 'otp' ? 'numeric' : undefined}
                pattern={field.name === 'otp' ? '[0-9]{6}' : undefined}
                aria-invalid={Boolean(state.fields[field.name])}
                aria-describedby={
                  state.fields[field.name] ? `transfer-${field.name}-error` : undefined
                }
              />
              {state.fields[field.name] ? (
                <p id={`transfer-${field.name}-error`} className='text-sm text-rose-200'>
                  {state.fields[field.name]}
                </p>
              ) : null}
            </div>
          ))}
          <label className='flex items-start gap-3 text-sm leading-6 text-slate-200'>
            <input
              type='checkbox'
              name='acceptOwnership'
              required
              className='mt-1 h-4 w-4 shrink-0 accent-cyan-300'
            />
            <span>I accept admin ownership. The current owner will lose admin access.</span>
          </label>
          {state.fields.acceptOwnership ? (
            <p className='text-sm text-rose-200'>{state.fields.acceptOwnership}</p>
          ) : null}
          <button
            type='submit'
            disabled={pending}
            className='inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60'
          >
            {pending ? <Loader2 size={17} className='animate-spin' /> : <ShieldCheck size={17} />}
            {pending ? 'Accepting...' : 'Accept Ownership'}
          </button>
        </fieldset>
        {state.error ? (
          <p role='alert' className='text-sm leading-6 text-rose-200'>
            {state.error}
          </p>
        ) : null}
      </form>
      {state.error ? (
        <Link
          href={buildAdminUnlockPath('/admin')}
          className='inline-flex min-h-10 items-center gap-2 text-sm text-cyan-200'
        >
          Check Admin Access <ArrowRight size={16} />
        </Link>
      ) : null}
      <AdminTransferSwitchAccount challengeId={challengeId} />
    </div>
  );
}

export function AdminTransferSwitchAccount({ challengeId }: { challengeId: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type='button'
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await logoutUserTo(buildAdminTransferAcceptancePath(challengeId));
        } finally {
          setPending(false);
        }
      }}
      className='inline-flex min-h-10 items-center justify-center gap-2 text-sm text-slate-300 disabled:opacity-60'
    >
      {pending ? <Loader2 size={16} className='animate-spin' /> : <LogOut size={16} />} Sign Out And
      Switch Account
    </button>
  );
}
