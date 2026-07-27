import { Database, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShopOpsDataTargetView } from '@/lib/prisma/shop/shopOpsDataTarget';

export default function ShopOpsDataTargetBadge({
  status,
  className,
}: {
  status: ShopOpsDataTargetView;
  className?: string;
}) {
  const isProduction = status.target === 'prod';
  const hasConfigurationError = !status.aligned || !status.configured;
  const Icon = hasConfigurationError || status.isLocalProductionTarget ? ShieldAlert : Database;
  const label = hasConfigurationError
    ? 'Shop Ops target unavailable'
    : isProduction
      ? 'Production data'
      : 'Development data';
  const detail = hasConfigurationError
    ? (status.configurationError ?? 'Shop Ops data target is not configured.')
    : status.isLocalProductionTarget
      ? status.localProductionMutationsEnabled
        ? 'Local runtime; live mutations require master confirmation'
        : 'Local runtime; live mutations are locked'
      : status.nodeEnv === 'production'
        ? 'Production runtime'
        : 'Local development runtime';

  return (
    <div
      role={hasConfigurationError ? 'alert' : 'status'}
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5',
        hasConfigurationError || isProduction
          ? 'border-rose-300/25 bg-rose-300/[0.07] text-rose-50'
          : 'border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50',
        className,
      )}
    >
      <Icon size={17} className='shrink-0' />
      <div className='min-w-0'>
        <p className='text-sm font-semibold'>{label}</p>
        <p className='truncate text-xs opacity-70'>{detail}</p>
      </div>
    </div>
  );
}
