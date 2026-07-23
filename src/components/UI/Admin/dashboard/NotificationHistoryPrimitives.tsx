import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  sent: 'border-emerald-300/15 bg-emerald-300/8 text-emerald-200',
  failed: 'border-rose-300/15 bg-rose-300/8 text-rose-200',
  pending: 'border-amber-300/15 bg-amber-300/8 text-amber-200',
  suppressed: 'border-slate-300/15 bg-slate-300/8 text-slate-300',
};

export function NotificationStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'shrink-0 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status] ?? 'border-white/15 bg-white/[0.04] text-slate-300',
      )}
    >
      {status}
    </span>
  );
}

export function NotificationActionButton({
  icon: Icon,
  label,
  disabled = false,
  pending,
  pendingLabel,
  tone = 'primary',
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
  pending: boolean;
  pendingLabel: string;
  tone?: 'primary' | 'secondary';
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'primary'
          ? 'border-cyan-300/20 bg-cyan-300/8 text-cyan-100 hover:border-cyan-200/35 hover:bg-cyan-300/12'
          : 'border-white/10 bg-white/[0.03] text-slate-200 hover:border-white/20 hover:text-white',
      )}
    >
      {pending ? (
        <Loader2 aria-hidden='true' className='animate-spin' size={14} />
      ) : (
        <Icon aria-hidden='true' size={14} />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}

export function formatNotificationType(type: string) {
  return type.replaceAll('_', ' ');
}

export function formatNotificationTiming(createdAt: string, sentAt: string | null) {
  return `Created ${createdAt}${sentAt ? ` · Sent ${sentAt}` : ''}`;
}
