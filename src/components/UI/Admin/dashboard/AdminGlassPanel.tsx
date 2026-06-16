import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AdminGlassPanelProps = {
  children: ReactNode;
  className?: string;
};

export default function AdminGlassPanel({ children, className }: AdminGlassPanelProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-white/10 bg-slate-900/48 shadow-[0_18px_54px_rgba(0,0,0,0.32)] supports-[backdrop-filter]:backdrop-blur-xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
