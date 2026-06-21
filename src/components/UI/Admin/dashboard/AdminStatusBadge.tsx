import { cn } from '@/lib/utils';
import type { PaidOrderRecoveryRow, ToolState } from './adminShopDashboardTypes';

const toolStateLabel: Record<ToolState, string> = {
  healthy: 'Healthy',
  action: 'Action',
  pending: 'Pending',
  critical: 'Critical',
  review: 'Review',
  ready: 'Ready',
  open: 'Open',
  warning: 'Warning',
};

const toolStateClass: Record<ToolState, string> = {
  healthy: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-200',
  action: 'border-amber-300/20 bg-amber-400/12 text-amber-200',
  pending: 'border-blue-300/20 bg-blue-400/12 text-blue-200',
  critical: 'border-rose-300/20 bg-rose-400/12 text-rose-200',
  review: 'border-amber-300/20 bg-amber-400/12 text-amber-200',
  ready: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-200',
  open: 'border-blue-300/20 bg-blue-400/12 text-blue-200',
  warning: 'border-amber-300/20 bg-amber-400/12 text-amber-200',
};

const paidOrderRecoveryStatusClass: Record<PaidOrderRecoveryRow['status'], string> = {
  failed: 'border-rose-300/20 bg-rose-400/12 text-rose-200',
  recovery: 'border-amber-300/20 bg-amber-400/12 text-amber-200',
  pending: 'border-blue-300/20 bg-blue-400/12 text-blue-200',
  completed: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-200',
  sync: 'border-cyan-300/20 bg-cyan-400/12 text-cyan-100',
  attention: 'border-amber-300/20 bg-amber-400/12 text-amber-200',
};

const paidOrderRecoveryStatusLabel: Record<PaidOrderRecoveryRow['status'], string> = {
  failed: 'failed',
  recovery: 'recovery',
  pending: 'pending',
  completed: 'completed',
  sync: 'sync needed',
  attention: 'attention',
};

export function AdminToolStateBadge({ state }: { state: ToolState }) {
  return (
    <span
      className={cn('rounded-md border px-2.5 py-1 text-xs font-medium', toolStateClass[state])}
    >
      {toolStateLabel[state]}
    </span>
  );
}

export function AdminPaidOrderRecoveryStatusBadge({
  status,
}: {
  status: PaidOrderRecoveryRow['status'];
}) {
  return (
    <span
      className={cn(
        'rounded-md border px-2 py-1 text-[11px] uppercase whitespace-nowrap',
        paidOrderRecoveryStatusClass[status],
      )}
    >
      {paidOrderRecoveryStatusLabel[status]}
    </span>
  );
}
