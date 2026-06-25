import Link from 'next/link';
import { cn } from '@/lib/utils';
import type {
  AdminDashboardNavigationGroup,
  AdminDashboardNavigationItem,
  AdminDashboardSection,
} from './adminDashboardTypes';

type AdminDashboardNavigationListProps = {
  activeSection: AdminDashboardSection;
  groups: AdminDashboardNavigationGroup[];
  mode: 'desktop' | 'mobile';
  onNavigate?: () => void;
};

export default function AdminDashboardNavigationList({
  activeSection,
  groups,
  mode,
  onNavigate,
}: AdminDashboardNavigationListProps) {
  return (
    <nav
      className={cn(
        'flex min-w-0 flex-col gap-4 overflow-x-hidden',
        mode === 'desktop'
          ? 'min-h-0 flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]'
          : 'px-3 pb-4',
      )}
    >
      {groups.map((group) => (
        <section key={group.id} className='min-w-0 space-y-1'>
          <p className='px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400'>
            {group.label}
          </p>
          <div className='grid min-w-0 gap-1'>
            {group.items.map((item) => (
              <AdminDashboardNavigationItem
                key={`${group.id}-${item.title}`}
                active={item.section === activeSection}
                item={item}
                mode={mode}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      ))}
    </nav>
  );
}

function AdminDashboardNavigationItem({
  active,
  item,
  mode,
  onNavigate,
}: {
  active: boolean;
  item: AdminDashboardNavigationItem;
  mode: 'desktop' | 'mobile';
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <Icon size={mode === 'mobile' ? 18 : 17} className='shrink-0' />
      <span className='min-w-0 flex-1'>
        <span className='block truncate'>{item.title}</span>
        {item.description ? (
          <span className='mt-0.5 block truncate text-[11px] font-normal text-slate-400'>
            {item.description}
          </span>
        ) : null}
      </span>
      {item.count ? (
        <span className='ml-auto rounded-md border border-amber-300/20 bg-amber-400/12 px-2 py-0.5 text-[11px] text-amber-200'>
          {item.count}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    'inline-flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg border text-left text-sm font-medium transition',
    mode === 'mobile' ? 'px-3.5 py-3' : 'px-3 py-2.5',
    active
      ? 'border-cyan-300/25 bg-cyan-300/10 text-white shadow-[inset_3px_0_0_rgba(34,211,238,0.75)]'
      : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white',
  );

  if (item.href) {
    return (
      <Link href={item.href} className={className} onClick={onNavigate}>
        {content}
      </Link>
    );
  }

  return (
    <button type='button' className={cn(className, 'cursor-default')}>
      {content}
    </button>
  );
}
