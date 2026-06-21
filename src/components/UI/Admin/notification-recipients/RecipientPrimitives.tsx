'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, CircleOff, Mail, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/UI/primitives/alert-dialog';
import { cn } from '@/lib/utils';
import type { ActiveRecipient } from './types';

export function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2'>
      <p className='text-[11px] uppercase tracking-[0.14em] text-slate-500'>{label}</p>
      <p className='mt-1 text-lg font-semibold text-white'>{value}</p>
    </div>
  );
}

export function RouteChip({
  tone,
  label,
}: {
  tone: 'cyan' | 'emerald' | 'amber' | 'slate';
  label: string;
}) {
  const toneClass = {
    cyan: 'border-cyan-300/15 bg-cyan-300/10 text-cyan-100',
    emerald: 'border-emerald-300/15 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/15 bg-amber-300/10 text-amber-100',
    slate: 'border-white/10 bg-white/[0.04] text-slate-400',
  }[tone];

  return (
    <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px]', toneClass)}>{label}</span>
  );
}

export function StatusBadge({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <span className='inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300/15 bg-white/[0.04] px-2 py-1 text-xs text-slate-300'>
        <CircleOff size={12} />
        route off
      </span>
    );
  }

  return (
    <span className='inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-100'>
      <CheckCircle2 size={12} />
      route on
    </span>
  );
}

export function CountChip({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <span className='inline-flex h-8 items-center gap-2 rounded-md border border-white/[0.07] bg-slate-950/25 px-2.5 text-xs text-slate-300'>
      <Icon size={13} className='text-slate-500' />
      <span className='uppercase tracking-[0.12em] text-slate-500'>{label}</span>
      <strong className='font-semibold text-white'>{value}</strong>
    </span>
  );
}

export function CurrentRecipientList({
  activeRecipients,
  emptyLabel,
  enabled,
  title,
}: {
  activeRecipients: ActiveRecipient[];
  emptyLabel: string;
  enabled: boolean;
  title: string;
}) {
  const previewRecipients = activeRecipients.slice(0, 2);
  const hiddenRecipientCount = Math.max(activeRecipients.length - previewRecipients.length, 0);

  return (
    <section className='min-w-0'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='flex min-w-0 shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500'>
          <UsersRound size={14} className='shrink-0 text-cyan-100' />
          <span className='truncate'>{title}</span>
        </div>
        <span className='shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-slate-300'>
          {activeRecipients.length}
        </span>

        {activeRecipients.length ? (
          <>
            {previewRecipients.map((recipient) => (
              <span
                key={`${recipient.source}-${recipient.email}`}
                className='inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-xs text-slate-200'
              >
                {recipient.source === 'master' ? (
                  <ShieldCheck size={12} className='shrink-0 text-emerald-200' />
                ) : (
                  <Mail size={12} className='shrink-0 text-cyan-200' />
                )}
                <span className='truncate'>{recipient.email}</span>
                <SourceChip source={recipient.source} />
              </span>
            ))}
            {hiddenRecipientCount ? (
              <span className='inline-flex items-center rounded-md border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-xs text-slate-400'>
                +{hiddenRecipientCount}
              </span>
            ) : null}
          </>
        ) : (
          <span className='inline-flex min-h-7 items-center gap-2 rounded-md border border-dashed border-white/10 bg-slate-950/20 px-2 text-xs text-slate-500'>
            <CircleOff size={14} />
            {enabled ? emptyLabel : 'Group disabled'}
          </span>
        )}
      </div>
    </section>
  );
}

export function SectionHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
}) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='inline-flex items-center gap-2 text-sm font-semibold text-white'>
        <Icon size={15} className='text-cyan-100' />
        {title}
      </div>
      <span className='rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300'>
        {detail}
      </span>
    </div>
  );
}

export function RecipientRow({
  recipient,
  onRemove,
}: {
  recipient: ActiveRecipient;
  onRemove: () => void;
}) {
  const isMaster = recipient.source === 'master';
  const isGlobal = recipient.source === 'global';

  return (
    <div className='flex min-h-11 items-center justify-between gap-3 rounded-lg border border-white/[0.055] bg-slate-950/30 px-3 py-2'>
      <div className='flex min-w-0 items-center gap-3'>
        <span
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
            isMaster
              ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
              : isGlobal
                ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
          )}
        >
          {isMaster ? <ShieldCheck size={15} /> : <Mail size={15} />}
        </span>
        <div className='min-w-0'>
          <p className='truncate text-sm text-white'>{recipient.email}</p>
          <p className='truncate text-xs text-slate-500'>{recipient.label}</p>
        </div>
      </div>

      {recipient.removable ? (
        <ConfirmLocalRecipientRemoval recipientEmail={recipient.email} onConfirm={onRemove} />
      ) : (
        <span
          className={cn(
            'shrink-0 rounded-md border px-2 py-1 text-xs',
            isGlobal
              ? 'border-amber-300/15 bg-amber-300/10 text-amber-100'
              : 'border-emerald-300/15 bg-emerald-300/10 text-emerald-100',
          )}
        >
          {isGlobal ? 'Global' : 'Master'}
        </span>
      )}
    </div>
  );
}

export function EmptyRecipientState({ label = 'None' }: { label?: string }) {
  return (
    <div className='flex min-h-16 items-center gap-2 rounded-lg border border-dashed border-white/10 bg-slate-950/20 px-3 text-sm text-slate-500'>
      <CircleOff size={16} />
      {label}
    </div>
  );
}

export function Message({ tone, children }: { tone: 'rose' | 'emerald'; children: ReactNode }) {
  const toneClass = {
    rose: 'border-rose-300/20 bg-rose-400/10 text-rose-100',
    emerald: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  }[tone];

  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs leading-5',
        toneClass,
      )}
    >
      {children}
    </p>
  );
}

function SourceChip({ source }: { source: ActiveRecipient['source'] }) {
  const toneClass = {
    custom: 'border-cyan-300/15 bg-cyan-300/10 text-cyan-100',
    global: 'border-amber-300/15 bg-amber-300/10 text-amber-100',
    master: 'border-emerald-300/15 bg-emerald-300/10 text-emerald-100',
  }[source];
  const label = source === 'master' ? 'Master' : source === 'global' ? 'Global' : 'Custom';

  return (
    <span className={cn('shrink-0 rounded border px-1.5 py-0.5 text-[10px]', toneClass)}>
      {label}
    </span>
  );
}

function ConfirmLocalRecipientRemoval({
  recipientEmail,
  onConfirm,
}: {
  recipientEmail: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type='button'
          className='inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-300/20 bg-rose-300/10 px-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/15'
        >
          <Trash2 size={13} />
          Remove
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className='w-[min(92vw,440px)] rounded-lg border border-white/10 bg-slate-950/95 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-white'>Remove notification recipient?</AlertDialogTitle>
          <AlertDialogDescription className='break-words text-slate-400'>
            This removes {recipientEmail} from the pending recipient list. Save routing to persist
            the change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className='border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] hover:text-white'>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            type='button'
            onClick={onConfirm}
            className='bg-rose-400 text-slate-950 hover:bg-rose-300'
          >
            Confirm Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
