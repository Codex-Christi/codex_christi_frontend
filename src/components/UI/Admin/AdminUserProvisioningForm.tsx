'use client';

import { useActionState, useState } from 'react';
import { Loader2, Search, ShieldPlus } from 'lucide-react';
import {
  previewCodexChristiUserProfileAction,
  provisionAdminUserAction,
  type CodexUserProfilePreviewActionState,
  type AdminUserProvisionActionState,
} from '@/app/admin/(dashboard)/admin-ops/actions';
import AdminCodexUserProfilePreview from '@/components/UI/Admin/AdminCodexUserProfilePreview';
import {
  adminFieldClass,
  adminInsetSurfaceClass,
} from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import { cn } from '@/lib/utils';

const initialState: AdminUserProvisionActionState = {
  error: null,
  success: null,
};

const initialPreviewState: CodexUserProfilePreviewActionState = {
  error: null,
  profile: null,
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
  const [codexUserId, setCodexUserId] = useState('');
  const [state, formAction, pending] = useActionState(provisionAdminUserAction, initialState);
  const [previewState, previewAction, previewPending] = useActionState(
    previewCodexChristiUserProfileAction,
    initialPreviewState,
  );
  const verifiedProfile =
    previewState.profile?.id === codexUserId.trim() ? previewState.profile : null;

  return (
    <form action={formAction} className='space-y-3'>
      <div className='grid gap-3'>
        <TextField
          label='Codex Christi user ID'
          name='codexUserId'
          autoComplete='off'
          value={codexUserId}
          onChange={setCodexUserId}
          required
        />
        <button
          type='submit'
          formAction={previewAction}
          formNoValidate
          disabled={previewPending || !codexUserId.trim()}
          className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {previewPending ? <Loader2 size={15} className='animate-spin' /> : <Search size={15} />}
          {previewPending ? 'Checking...' : 'Preview Codex Christi User'}
        </button>
        {previewState.error ? <Message tone='rose'>{previewState.error}</Message> : null}
        {verifiedProfile ? <AdminCodexUserProfilePreview profile={verifiedProfile} /> : null}
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
          <select name='role' defaultValue='admin' className={adminFieldClass}>
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
                className={cn(
                  adminInsetSurfaceClass,
                  'flex min-h-9 items-center gap-2 px-2 text-xs text-slate-200',
                )}
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
          <select name='status' defaultValue='active' className={adminFieldClass}>
            <option value='active'>Active</option>
            <option value='disabled'>Disabled</option>
          </select>
        </label>
      </div>

      {state.error ? <Message tone='rose'>{state.error}</Message> : null}
      {state.success ? (
        <Message tone='emerald'>{state.success}</Message>
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
  value,
  onChange,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className='grid gap-1 text-xs font-medium text-slate-300'>
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        required={required}
        className={adminFieldClass}
      />
    </label>
  );
}

function Message({
  children,
  tone,
}: {
  children: string;
  tone: 'emerald' | 'rose';
}) {
  const toneClass = {
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
    rose: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
  }[tone];

  return <p className={`rounded-lg border px-3 py-2 text-xs leading-5 ${toneClass}`}>{children}</p>;
}
