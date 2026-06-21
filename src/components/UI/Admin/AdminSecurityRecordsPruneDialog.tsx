'use client';

import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { DatabaseZap, Loader2, ShieldAlert } from 'lucide-react';
import {
  runMinimumStorageLedgerCleanupAction,
  type RunAdminOpsLedgerPruneActionState,
} from '@/app/admin/(dashboard)/admin-ops/security-records/actions';
import { adminFieldClass } from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/primitives/alert-dialog';
import { cn } from '@/lib/utils';

const initialState: RunAdminOpsLedgerPruneActionState = {
  deleted: null,
  error: null,
  success: null,
};

export default function AdminSecurityRecordsPruneDialog({
  eligibleTotal,
}: {
  eligibleTotal: number;
}) {
  const [state, formAction, pending] = useActionState(
    runMinimumStorageLedgerCleanupAction,
    initialState,
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type='button'
          className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15'
        >
          <DatabaseZap size={16} />
          Run Cleanup
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className='w-[min(94vw,560px)] rounded-lg border border-white/10 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-white'>Run minimum-storage cleanup</AlertDialogTitle>
          <AlertDialogDescription className='text-slate-400'>
            This deletes eligible security records across unlock attempts, audit logs, and master
            transfer challenges. Your master admin password is required.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={formAction} className='space-y-4'>
          <div className='flex items-start gap-2 rounded-lg border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100'>
            <ShieldAlert size={15} className='mt-0.5 shrink-0' />
            Current preview shows {eligibleTotal} eligible record
            {eligibleTotal === 1 ? '' : 's'}. The cleanup result may differ if records changed
            after the preview loaded.
          </div>

          <label className='grid gap-1 text-xs font-medium text-slate-300'>
            Master admin password
            <input
              type='password'
              name='password'
              required
              autoComplete='current-password'
              className={adminFieldClass}
            />
          </label>

          {state.error ? <Message tone='rose'>{state.error}</Message> : null}
          {state.success ? (
            <Message tone='emerald'>
              {state.success}
              {state.deleted
                ? ` Unlock attempts: ${state.deleted.unlockAttempts}. Audit logs: ${state.deleted.auditLogs}. Transfer challenges: ${state.deleted.masterTransferChallenges}.`
                : ''}
            </Message>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel className='border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white'>
              Cancel
            </AlertDialogCancel>
            <button
              type='submit'
              disabled={pending}
              className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {pending ? <Loader2 size={16} className='animate-spin' /> : <DatabaseZap size={16} />}
              {pending ? 'Cleaning...' : 'Confirm Cleanup'}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Message({ tone, children }: { tone: 'rose' | 'emerald'; children: ReactNode }) {
  const toneClass = {
    rose: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  }[tone];

  return (
    <p className={cn('rounded-lg border px-3 py-2 text-xs leading-5', toneClass)}>{children}</p>
  );
}
