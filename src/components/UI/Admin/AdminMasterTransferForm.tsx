'use client';

import type { ReactNode } from 'react';
import { useActionState, useState } from 'react';
import { KeyRound, Loader2, Search, ShieldCheck, UserRoundCog } from 'lucide-react';
import {
  completeMasterAdminTransferAction,
  previewCodexChristiUserProfileAction,
  startMasterAdminTransferAction,
  type CodexUserProfilePreviewActionState,
  type MasterAdminTransferCompleteActionState,
  type MasterAdminTransferStartActionState,
} from '@/app/admin/(dashboard)/admin-ops/actions';
import AdminCodexUserProfilePreview from '@/components/UI/Admin/AdminCodexUserProfilePreview';
import {
  adminFieldClass,
  adminInsetSurfaceClass,
} from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import { cn } from '@/lib/utils';

const initialStartState: MasterAdminTransferStartActionState = {
  error: null,
  challenge: null,
};

const initialCompleteState: MasterAdminTransferCompleteActionState = {
  error: null,
};

const initialPreviewState: CodexUserProfilePreviewActionState = {
  error: null,
  profile: null,
};

export default function AdminMasterTransferForm() {
  const [targetCodexUserId, setTargetCodexUserId] = useState('');
  const [startState, startAction, startPending] = useActionState(
    startMasterAdminTransferAction,
    initialStartState,
  );
  const [completeState, completeAction, completePending] = useActionState(
    completeMasterAdminTransferAction,
    initialCompleteState,
  );
  const [previewState, previewAction, previewPending] = useActionState(
    previewCodexChristiUserProfileAction,
    initialPreviewState,
  );
  const verifiedProfile =
    previewState.profile?.id === targetCodexUserId.trim() ? previewState.profile : null;

  return (
    <div className='space-y-3'>
      <form action={startAction} className='space-y-3'>
        <TextField
          label='Current unlock password'
          name='currentAdminPassword'
          type='password'
          autoComplete='current-password'
          required
        />
        <TextField
          label='Target Codex Christi user ID'
          name='targetCodexUserId'
          value={targetCodexUserId}
          onChange={setTargetCodexUserId}
          required
        />
        <button
          type='submit'
          formAction={previewAction}
          formNoValidate
          disabled={previewPending || !targetCodexUserId.trim()}
          className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {previewPending ? <Loader2 size={15} className='animate-spin' /> : <Search size={15} />}
          {previewPending ? 'Checking...' : 'Preview Target User'}
        </button>
        {previewState.error ? <Message tone='rose'>{previewState.error}</Message> : null}
        {verifiedProfile ? <AdminCodexUserProfilePreview profile={verifiedProfile} /> : null}
        <TextField
          label='Target email'
          name='targetEmail'
          type='email'
          autoComplete='email'
          required
        />
        <TextField
          label='New target unlock password'
          name='targetAdminPassword'
          type='password'
          autoComplete='new-password'
          minLength={12}
          required
        />

        {startState.error ? <Message tone='rose'>{startState.error}</Message> : null}

        <button
          type='submit'
          disabled={startPending}
          className='inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {startPending ? (
            <Loader2 size={16} className='animate-spin' />
          ) : (
            <UserRoundCog size={16} />
          )}
          {startPending ? 'Sending...' : 'Send Transfer Code'}
        </button>
      </form>

      {startState.challenge ? (
        <form action={completeAction} className={cn(adminInsetSurfaceClass, 'space-y-3 p-3')}>
          <input type='hidden' name='challengeId' value={startState.challenge.challengeId} />
          <div className='flex items-start gap-2 text-xs leading-5 text-slate-300'>
            <ShieldCheck size={16} className='mt-0.5 shrink-0 text-cyan-200' />
            <span>
              {startState.challenge.targetCodexUserId} · {startState.challenge.targetEmailHint}
            </span>
          </div>
          <TextField
            label='Transfer code'
            name='otp'
            inputMode='numeric'
            autoComplete='one-time-code'
            minLength={6}
            maxLength={6}
            required
          />

          {completeState.error ? <Message tone='rose'>{completeState.error}</Message> : null}

          <button
            type='submit'
            disabled={completePending}
            className='inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {completePending ? (
              <Loader2 size={16} className='animate-spin' />
            ) : (
              <KeyRound size={16} />
            )}
            {completePending ? 'Transferring...' : 'Transfer And Sign Out'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function TextField({
  label,
  name,
  type = 'text',
  autoComplete,
  inputMode,
  value,
  onChange,
  minLength,
  maxLength,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'numeric';
  value?: string;
  onChange?: (value: string) => void;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <label className='grid gap-1 text-xs font-medium text-slate-300'>
      {label}
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        minLength={minLength}
        maxLength={maxLength}
        required={required}
        className={adminFieldClass}
      />
    </label>
  );
}

function Message({ tone, children }: { tone: 'rose'; children: ReactNode }) {
  const toneClass = {
    rose: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
  }[tone];

  return <p className={`rounded-lg border px-3 py-2 text-xs leading-5 ${toneClass}`}>{children}</p>;
}
