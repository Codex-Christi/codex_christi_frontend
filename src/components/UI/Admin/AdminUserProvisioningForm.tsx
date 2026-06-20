'use client';

import { useActionState } from 'react';
import { Loader2, ShieldPlus } from 'lucide-react';
import {
  provisionAdminUserAction,
  type AdminUserProvisionActionState,
} from '@/app/admin/admin-ops/actions';

const initialState: AdminUserProvisionActionState = {
  error: null,
  success: null,
};

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'support', label: 'Support' },
  { value: 'viewer', label: 'Viewer' },
] as const;

const scopeOptions = [
  { value: 'audit.view', label: 'Audit' },
  { value: 'settings.manage', label: 'Settings' },
  { value: 'shop', label: 'Shop' },
  { value: 'shop.view', label: 'Shop view' },
  { value: 'shop.recovery.run', label: 'Recovery' },
  { value: 'shop.catalog.refresh', label: 'Catalog' },
] as const;

export default function AdminUserProvisioningForm() {
  const [state, formAction, pending] = useActionState(
    provisionAdminUserAction,
    initialState,
  );

  return (
    <form action={formAction} className='space-y-3'>
      <div className='grid gap-3'>
        <TextField
          label='Codex Christi user ID'
          name='codexUserId'
          autoComplete='off'
          required
        />
        <TextField label='Email' name='email' type='email' autoComplete='email' />
        <TextField label='Display name' name='displayName' autoComplete='name' />
        <TextField
          label='Unlock password'
          name='password'
          type='password'
          autoComplete='new-password'
        />

        <label className='grid gap-1 text-xs font-medium text-slate-300'>
          Role
          <select
            name='role'
            defaultValue='admin'
            className='h-10 rounded-lg border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none focus:border-cyan-300/40'
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className='space-y-2'>
          <legend className='text-xs font-medium text-slate-300'>Scopes</legend>
          <div className='grid grid-cols-2 gap-2'>
            {scopeOptions.map((option) => (
              <label
                key={option.value}
                className='flex min-h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 text-xs text-slate-200'
              >
                <input
                  type='checkbox'
                  name='scopes'
                  value={option.value}
                  defaultChecked={['shop', 'shop.view'].includes(option.value)}
                  className='h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-300'
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className='grid gap-1 text-xs font-medium text-slate-300'>
          Status
          <select
            name='status'
            defaultValue='active'
            className='h-10 rounded-lg border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none focus:border-cyan-300/40'
          >
            <option value='active'>Active</option>
            <option value='disabled'>Disabled</option>
          </select>
        </label>
      </div>

      {state.error ? (
        <p className='rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-100'>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className='rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs leading-5 text-emerald-100'>
          {state.success}
        </p>
      ) : null}

      <button
        type='submit'
        disabled={pending}
        className='inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {pending ? <Loader2 size={16} className='animate-spin' /> : <ShieldPlus size={16} />}
        {pending ? 'Saving...' : 'Save Operational Admin'}
      </button>
    </form>
  );
}

function TextField({
  label,
  name,
  type = 'text',
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className='grid gap-1 text-xs font-medium text-slate-300'>
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className='h-10 rounded-lg border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40'
      />
    </label>
  );
}
