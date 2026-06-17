'use client';

import { useState } from 'react';
import { Braces, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PaidOrderRecoveryRawLedgerDialog({
  rawDebug,
}: {
  rawDebug: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:text-white'
      >
        <Braces size={14} />
        Raw
      </button>

      {open ? (
        <div className='fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm'>
          <div className='w-full max-w-3xl overflow-hidden rounded-xl border border-white/12 bg-slate-950/95 shadow-2xl'>
            <div className='flex items-center justify-between border-b border-white/10 px-4 py-3'>
              <div>
                <p className='text-sm font-semibold text-white'>Ledger Debug Snapshot</p>
                <p className='mt-1 text-xs text-slate-500'>Current normalized admin debug payload.</p>
              </div>
              <button
                type='button'
                onClick={() => setOpen(false)}
                aria-label='Close raw ledger debug dialog'
                className='grid h-8 w-8 place-items-center rounded-md text-slate-400 transition hover:bg-white/[0.05] hover:text-white'
              >
                <X size={16} />
              </button>
            </div>
            <pre
              className={cn(
                'max-h-[70vh] overflow-auto p-4 text-xs leading-6 text-slate-300',
                'bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(2,6,23,0.96))]',
              )}
            >
              {JSON.stringify(rawDebug, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </>
  );
}
