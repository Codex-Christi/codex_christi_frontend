'use client';

import { useActionState } from 'react';
import { KeyRound, Loader2, ShieldCheck, UserRoundCog } from 'lucide-react';
import {
  completeMasterAdminTransferAction,
  startMasterAdminTransferAction,
  type MasterAdminTransferCompleteActionState,
  type MasterAdminTransferStartActionState,
} from '@/app/admin/actions';

const initialStartState: MasterAdminTransferStartActionState = {
  error: null,
  challenge: null,
};

const initialCompleteState: MasterAdminTransferCompleteActionState = {
  error: null,
};

export default function AdminMasterTransferForm() {
  const [startState, startAction, startPending] = useActionState(
    startMasterAdminTransferAction,
    initialStartState,
  );
  const [completeState, completeAction, completePending] = useActionState(
    completeMasterAdminTransferAction,
    initialCompleteState,
  );

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
        <TextField label='Target Codex user ID' name='targetCodexUserId' required />
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

        {startState.error ? (
          <Message tone='rose'>{startState.error}</Message>
        ) : null}

        <button
          type='submit'
          disabled={startPending}
          className='inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {startPending ? <Loader2 size={16} className='animate-spin' /> : <UserRoundCog size={16} />}
          {startPending ? 'Sending...' : 'Send Transfer Code'}
        </button>
      </form>

      {startState.challenge ? (
        <form action={completeAction} className='space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3'>
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

          {completeState.error ? (
            <Message tone='rose'>{completeState.error}</Message>
          ) : null}

          <button
            type='submit'
            disabled={completePending}
            className='inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-rose-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60'
          >
            {completePending ? <Loader2 size={16} className='animate-spin' /> : <KeyRound size={16} />}
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
  minLength,
  maxLength,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  inputMode?: 'numeric';
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
        minLength={minLength}
        maxLength={maxLength}
        required={required}
        className='h-10 rounded-lg border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40'
      />
    </label>
  );
}

function Message({
  tone,
  children,
}: {
  tone: 'rose';
  children: React.ReactNode;
}) {
  const toneClass = {
    rose: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
  }[tone];

  return <p className={`rounded-lg border px-3 py-2 text-xs leading-5 ${toneClass}`}>{children}</p>;
}
