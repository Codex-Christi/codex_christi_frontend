import { cn } from '@/lib/utils';
import type { OrderRecoveryRow, ToolState } from './adminDashboardTypes';

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

const orderRecoveryStatusClass: Record<OrderRecoveryRow['status'], string> = {
  failed: 'border-rose-300/20 bg-rose-400/12 text-rose-200',
  recovery: 'border-amber-300/20 bg-amber-400/12 text-amber-200',
  pending: 'border-blue-300/20 bg-blue-400/12 text-blue-200',
  completed: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-200',
};

export function AdminToolStateBadge({ state }: { state: ToolState }) {
  return (
    <span className={cn('rounded-md border px-2.5 py-1 text-xs font-medium', toolStateClass[state])}>
      {toolStateLabel[state]}
    </span>
  );
}

export function AdminOrderRecoveryStatusBadge({ status }: { status: OrderRecoveryRow['status'] }) {
  return (
    <span
      className={cn(
        'rounded-md border px-2 py-1 text-[11px] uppercase whitespace-nowrap',
        orderRecoveryStatusClass[status],
      )}
    >
      {status}
    </span>
  );
}
