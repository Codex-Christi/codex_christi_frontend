import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type AdminGlassPanelProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
};

export const adminGlassPanelClass =
  'rounded-lg border border-white/[0.055] bg-[linear-gradient(145deg,rgba(76,61,61,0.22),rgba(15,23,42,0.30)_56%,rgba(8,15,30,0.36))] shadow-[0_18px_48px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.055)] supports-[backdrop-filter]:backdrop-blur-[18px] supports-[backdrop-filter]:backdrop-saturate-150';

export const adminInteractiveGlassPanelClass =
  'transition hover:border-white/12 hover:bg-[linear-gradient(145deg,rgba(88,72,72,0.28),rgba(15,23,42,0.34)_56%,rgba(8,15,30,0.40))] hover:shadow-[0_22px_58px_rgba(14,165,233,0.10),inset_0_1px_0_rgba(255,255,255,0.07)]';

export const adminInsetSurfaceClass =
  'rounded-lg border border-white/[0.04] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';

export const adminFieldClass =
  'h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-slate-500 transition focus:border-cyan-200/35 focus:bg-black/25 focus:ring-2 focus:ring-cyan-200/10 supports-[backdrop-filter]:backdrop-blur-xl';

export function getAdminGlassPanelClassName(
  className?: string,
  options: { interactive?: boolean } = {},
) {
  return cn(
    adminGlassPanelClass,
    options.interactive && adminInteractiveGlassPanelClass,
    className,
  );
}

export default function AdminGlassPanel({
  children,
  className,
  interactive = false,
}: AdminGlassPanelProps) {
  return <div className={getAdminGlassPanelClassName(className, { interactive })}>{children}</div>;
}
