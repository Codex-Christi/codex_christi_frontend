import Link from 'next/link';
import { cn } from '@/lib/utils';
import { adminShopNavItems } from './adminShopDashboardData';
import type { AdminShopScope, NavItem } from './adminShopDashboardTypes';

type AdminNavigationListProps = {
  scope: AdminShopScope;
  mode: 'desktop' | 'mobile';
  onNavigate?: () => void;
};

export default function AdminNavigationList({ scope, mode, onNavigate }: AdminNavigationListProps) {
  return (
    <nav
      className={cn(
        'flex gap-1',
        mode === 'desktop'
          ? 'min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3'
          : 'flex-col px-3 pb-4',
      )}
    >
      {adminShopNavItems.map((item) => (
        <AdminNavigationItem
          key={item.label}
          item={item}
          active={isAdminNavItemActive(item, scope)}
          mode={mode}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function AdminNavigationItem({
  item,
  active,
  mode,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  mode: 'desktop' | 'mobile';
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const content = (
    <>
      <Icon size={mode === 'mobile' ? 18 : 17} className='shrink-0' />
      <span className='truncate'>{item.label}</span>
      {item.count ? (
        <span className='ml-auto rounded-md border border-amber-300/20 bg-amber-400/12 px-2 py-0.5 text-[11px] text-amber-200'>
          {item.count}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    'inline-flex w-full items-center gap-3 rounded-lg border text-left text-sm transition',
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

function isAdminNavItemActive(item: NavItem, scope: AdminShopScope) {
  if (item.label === 'Shop Overview') {
    return scope === 'shop';
  }

  if (item.label === 'Paid Order Recovery') {
    return scope === 'shop-paid-order-recovery';
  }

  if (item.label === 'Reconciliation') {
    return scope === 'shop-payment-reconciliation';
  }

  return scope === 'shop-catalog-snapshots' && item.label === 'Catalog & Snapshots';
}
