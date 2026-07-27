'use client';

import { useRef, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/UI/primitives/dialog';

export default function PaidOrderRecoveryHistoryDialog({
  triggerLabel,
  title,
  description,
  children,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type='button'
          className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.08] px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60'
        >
          {triggerLabel}
          <ChevronRight size={15} aria-hidden='true' />
        </button>
      </DialogTrigger>

      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        className='flex max-h-[calc(100dvh-2rem)] w-[min(94vw,760px)] max-w-none flex-col overflow-hidden rounded-xl border border-white/15 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'
      >
        <DialogHeader className='shrink-0 pr-8'>
          <DialogTitle ref={titleRef} tabIndex={-1} className='text-white outline-none'>
            {title}
          </DialogTitle>
          <DialogDescription className='text-sm leading-6 text-slate-300'>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 overscroll-contain overflow-y-auto pr-1'>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
