'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

type AdminCopyValueButtonProps = {
  className?: string;
  label: string;
  value: string;
};

export default function AdminCopyValueButton({
  className,
  label,
  value,
}: AdminCopyValueButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type='button'
      onClick={() => void handleCopy()}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? 'Copied' : `Copy ${label}`}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60',
        copied && 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200',
        className,
      )}
    >
      {copied ? <Check size={14} aria-hidden='true' /> : <Copy size={14} aria-hidden='true' />}
    </button>
  );
}
