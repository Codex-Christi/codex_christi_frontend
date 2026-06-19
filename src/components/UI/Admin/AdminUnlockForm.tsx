'use client';

import { useActionState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import {
  unlockAdminAction,
  type AdminUnlockActionState,
} from '@/app/admin/unlock/actions';

const initialState: AdminUnlockActionState = {
  error: null,
};

export default function AdminUnlockForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(unlockAdminAction, initialState);

  return (
    <form action={formAction} className='mx-auto w-full max-w-[420px] space-y-5'>
      <input type='hidden' name='next' value={nextPath} />

      <div className='space-y-2'>
        <div className='flex items-center gap-2 text-sm font-medium text-cyan-100'>
          <ShieldCheck size={17} />
          Admin unlock
        </div>
        <label className='sr-only' htmlFor='admin-password'>
          Admin password
        </label>
        <div className='flex h-12 items-center gap-3 rounded-lg border border-white/10 bg-slate-950/72 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-cyan-300/40'>
          <KeyRound size={18} className='shrink-0 text-slate-400' />
          <input
            id='admin-password'
            name='password'
            type='password'
            autoComplete='current-password'
            className='h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500'
            placeholder='Admin password'
            required
          />
        </div>
      </div>

      {state.error ? (
        <p className='rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100'>
          {state.error}
        </p>
      ) : null}

      <button
        type='submit'
        disabled={pending}
        className='inline-flex h-11 w-full items-center justify-center rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {pending ? 'Checking...' : 'Unlock Admin'}
      </button>
    </form>
  );
}

