'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpLeft, ChevronDown, X } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerTitle,
} from '@/components/UI/primitives/drawer';
import { useRouteChangeAware } from '@/lib/hooks/useRouteChangeAware';
import AdminGlassPanel from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import AdminDashboardNavigationList from './AdminDashboardNavigationList';
import type {
  AdminDashboardIdentity,
  AdminDashboardNavigationGroup,
  AdminDashboardSection,
} from './adminDashboardTypes';

type AdminDashboardMobileDrawerProps = {
  activeSection: AdminDashboardSection;
  identity: AdminDashboardIdentity | null;
  navigationGroups: AdminDashboardNavigationGroup[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export default function AdminDashboardMobileDrawer({
  activeSection,
  identity,
  navigationGroups,
  onOpenChange,
  open,
}: AdminDashboardMobileDrawerProps) {
  useRouteChangeAware(() => {
    onOpenChange(false);
  });

  return (
    <Drawer direction='left' open={open} onOpenChange={onOpenChange}>
      <DrawerOverlay className='bg-[#141923]/42 !backdrop-blur-[3px] xl:hidden' />
      <DrawerContent
        data-testid='admin-dashboard-mobile-drawer'
        className='!fixed !bottom-0 !left-0 !z-[500] h-[100dvh] min-h-[100dvh] w-full max-w-[360px] overflow-hidden !rounded-none border-r border-white/[0.055] bg-[rgba(20,25,35,0.82)] text-slate-50 shadow-[24px_0_70px_rgba(0,0,0,0.30)] after:!hidden supports-[backdrop-filter]:backdrop-blur-[18px] supports-[backdrop-filter]:backdrop-saturate-150 xl:hidden'
      >
        <DrawerTitle className='sr-only'>Admin navigation</DrawerTitle>
        <DrawerDescription className='sr-only'>
          Navigation drawer for Codex Christi admin tools.
        </DrawerDescription>

        <div className='flex h-full min-w-0 flex-col overflow-x-hidden'>
          <div className='flex min-h-20 min-w-0 items-center justify-between gap-3 border-b border-white/10 px-4'>
            <Link
              href='/admin'
              className='flex min-w-0 items-center gap-2'
              onClick={() => onOpenChange(false)}
            >
              <Image
                src='/media/img/general/logo.svg'
                alt='Codex Christi'
                width={146}
                height={63}
                priority
                className='h-11 min-w-0 max-w-[180px] shrink'
              />
              <span className='shrink-0 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100'>
                Admin
              </span>
            </Link>

            <div className='flex shrink-0 items-center gap-2'>
              <Link
                href='/'
                aria-label='Open site root'
                title='Site root'
                className='grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-cyan-300/25 hover:bg-white/[0.06] hover:text-cyan-100'
                onClick={() => onOpenChange(false)}
              >
                <ArrowUpLeft size={17} />
              </Link>

              <DrawerClose
                aria-label='Close admin navigation'
                className='grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200'
              >
                <X size={18} />
              </DrawerClose>
            </div>
          </div>

          <div className='min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden py-3 [scrollbar-width:thin]'>
            <AdminDashboardNavigationList
              activeSection={activeSection}
              groups={navigationGroups}
              mode='mobile'
              onNavigate={() => onOpenChange(false)}
            />
          </div>

          <div className='min-w-0 overflow-x-hidden border-t border-white/10 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]'>
            <AdminGlassPanel className='p-3'>
              <p className='text-[11px] text-slate-400'>Admin session</p>
              <div className='mt-2 flex items-center gap-2 text-sm text-slate-100'>
                <span className='h-2 w-2 rounded-full bg-emerald-300' />
                {identity?.role ?? 'Locked'}
              </div>
              <p className='mt-2 truncate text-[11px] text-slate-500'>
                {identity?.email ?? identity?.userID ?? 'Admin user'}
              </p>
            </AdminGlassPanel>

            <div className='mt-4 flex min-w-0 items-center gap-3 px-2'>
              <div className='grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white'>
                AD
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium text-white'>Admin User</p>
                <p className='truncate text-xs text-slate-400'>
                  {identity?.email ?? identity?.userID ?? 'Session pending'}
                </p>
              </div>
              <ChevronDown size={15} className='text-slate-500' />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
