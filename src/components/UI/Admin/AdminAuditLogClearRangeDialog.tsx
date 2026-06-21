'use client';

import { useActionState, useState } from 'react';
import { Clock3, Loader2, Trash2 } from 'lucide-react';
import {
  clearAdminAuditLogsByTimeRangeAction,
  type ClearAdminAuditLogsActionState,
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

const initialState: ClearAdminAuditLogsActionState = {
  error: null,
  success: null,
  deletedCount: null,
};

export default function AdminAuditLogClearRangeDialog() {
  const [state, formAction, pending] = useActionState(
    clearAdminAuditLogsByTimeRangeAction,
    initialState,
  );
  const [timeZoneOffsetMinutes] = useState(() => new Date().getTimezoneOffset());
  const [timeZoneLabel] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'browser local time',
  );
  const [defaultRange] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

    return {
      from: toDateTimeLocalValue(from),
      to: toDateTimeLocalValue(to),
    };
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type='button'
          className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-300/25 bg-rose-300/10 px-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/15'
        >
          <Trash2 size={16} />
          Clear Range
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className='w-[min(94vw,560px)] rounded-lg border border-white/10 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-white'>Clear admin audit logs</AlertDialogTitle>
          <AlertDialogDescription className='text-slate-400'>
            Select a created-at range to delete matching audit events. Clear-operation audit events
            are preserved. Your master admin password is required.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form action={formAction} className='space-y-4'>
          <input type='hidden' name='timeZoneOffsetMinutes' value={`${timeZoneOffsetMinutes}`} />

          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='grid gap-1 text-xs font-medium text-slate-300'>
              From
              <input
                type='datetime-local'
                name='from'
                required
                defaultValue={defaultRange.from}
                className={adminFieldClass}
              />
            </label>
            <label className='grid gap-1 text-xs font-medium text-slate-300'>
              To
              <input
                type='datetime-local'
                name='to'
                required
                defaultValue={defaultRange.to}
                className={adminFieldClass}
              />
            </label>
          </div>

          <div className='flex items-start gap-2 rounded-lg border border-amber-300/15 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100'>
            <Clock3 size={15} className='mt-0.5 shrink-0' />
            Times use {timeZoneLabel}. Only master admins can clear audit logs.
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
          {state.success ? <Message tone='emerald'>{state.success}</Message> : null}

          <AlertDialogFooter>
            <AlertDialogCancel className='border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white'>
              Cancel
            </AlertDialogCancel>
            <button
              type='submit'
              disabled={pending}
              className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-400 px-3 text-sm font-semibold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60'
            >
              {pending ? <Loader2 size={16} className='animate-spin' /> : <Trash2 size={16} />}
              {pending ? 'Clearing...' : 'Confirm Clear'}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Message({ tone, children }: { tone: 'rose' | 'emerald'; children: string }) {
  const toneClass = {
    rose: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  }[tone];

  return (
    <p className={cn('rounded-lg border px-3 py-2 text-xs leading-5', toneClass)}>{children}</p>
  );
}

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}`;
}
