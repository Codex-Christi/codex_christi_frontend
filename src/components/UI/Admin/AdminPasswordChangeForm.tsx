'use client';

import { useActionState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { adminPasswordChangeSchema } from '@/lib/formSchemas/admin-password';
import { postAdminAuth } from '@/lib/admin/admin-auth-client';
import { buildAdminUnlockPath } from '@/lib/admin/admin-paths';
import { adminFieldClass } from './dashboard/AdminGlassPanel';

const initialState: { error: string | null; fields: Record<string, string> } = {
  error: null,
  fields: {},
};

export default function AdminPasswordChangeForm() {
  const [state, action, pending] = useActionState(
    async (_previous: typeof initialState, form: FormData): Promise<typeof initialState> => {
      const parsed = adminPasswordChangeSchema.safeParse({
        currentPassword: form.get('currentPassword'),
        password: form.get('password'),
        confirmation: form.get('confirmation'),
      });
      if (!parsed.success)
        return {
          error: null,
          fields: Object.fromEntries(
            parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
          ),
        };
      const result = await postAdminAuth('password', parsed.data);
      if (!result.success) return { error: result.error, fields: {} };
      window.location.replace(`${buildAdminUnlockPath('/admin/security')}&passwordChanged=true`);
      return initialState;
    },
    initialState,
  );
  return (
    <form action={action} className='grid w-full max-w-md gap-5'>
      {[
        {
          name: 'currentPassword',
          label: 'Current unlock password',
          autoComplete: 'current-password',
          minLength: 1,
          maxLength: 1024,
        },
        {
          name: 'password',
          label: 'New unlock password',
          autoComplete: 'new-password',
          minLength: 12,
          maxLength: 128,
        },
        {
          name: 'confirmation',
          label: 'Confirm new unlock password',
          autoComplete: 'new-password',
          minLength: 12,
          maxLength: 128,
        },
      ].map((field) => (
        <div key={field.name} className='grid gap-2'>
          <label htmlFor={`admin-${field.name}`} className='text-sm font-medium text-slate-200'>
            {field.label}
          </label>
          <input
            name={field.name}
            autoComplete={field.autoComplete}
            minLength={field.minLength}
            maxLength={field.maxLength}
            id={`admin-${field.name}`}
            type='password'
            required
            disabled={pending}
            className={adminFieldClass}
            aria-invalid={Boolean(state.fields[field.name])}
            aria-describedby={state.fields[field.name] ? `admin-${field.name}-error` : undefined}
          />
          {state.fields[field.name] ? (
            <p id={`admin-${field.name}-error`} className='text-xs text-rose-200'>
              {state.fields[field.name]}
            </p>
          ) : null}
        </div>
      ))}
      {state.error ? (
        <p role='alert' className='text-sm text-rose-200'>
          {state.error}
        </p>
      ) : null}
      <button
        type='submit'
        disabled={pending}
        className='inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 disabled:cursor-wait disabled:opacity-60'
      >
        {pending ? <Loader2 size={17} className='animate-spin' /> : <KeyRound size={17} />}
        {pending ? 'Changing...' : 'Change unlock password'}
      </button>
    </form>
  );
}
