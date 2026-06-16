'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, X } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerTitle,
} from '@/components/UI/primitives/drawer';
import { useRouteChangeAware } from '@/lib/hooks/useRouteChangeAware';
import AdminGlassPanel from './AdminGlassPanel';
import AdminNavigationList from './AdminNavigationList';
import type { AdminScope } from './adminDashboardTypes';

type AdminMobileNavigationDrawerProps = {
  scope: AdminScope;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AdminMobileNavigationDrawer({
  scope,
  open,
  onOpenChange,
}: AdminMobileNavigationDrawerProps) {
  useRouteChangeAware(() => {
    onOpenChange(false);
  });

  return (
    <Drawer direction='left' open={open} onOpenChange={onOpenChange}>
      <DrawerOverlay className='bg-slate-950/35 !backdrop-blur-[3px] lg:hidden' />
      <DrawerContent
        data-testid='admin-mobile-navigation-drawer'
        className='!fixed !bottom-0 !left-0 !z-[500] h-[100dvh] min-h-[100dvh] w-full max-w-[360px] overflow-hidden !rounded-none border-r border-white/10 bg-slate-950/76 shadow-[24px_0_80px_rgba(0,0,0,0.46)] after:!hidden supports-[backdrop-filter]:backdrop-blur-2xl lg:hidden'
      >
        <DrawerTitle className='sr-only'>Admin navigation</DrawerTitle>
        <DrawerDescription className='sr-only'>
          Mobile navigation drawer for Codex Christi admin tools.
        </DrawerDescription>

        <div className='flex h-full flex-col'>
          <div className='flex min-h-20 items-center justify-between border-b border-white/10 px-4'>
            <Link
              href='/admin/shop'
              className='flex items-center gap-3'
              onClick={() => onOpenChange(false)}
            >
              <Image
                src='/media/img/general/logo.svg'
                alt='Codex Christi'
                width={146}
                height={63}
                priority
                className='h-11 w-auto'
              />
              <span className='rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-cyan-100'>
                Admin
              </span>
            </Link>

            <DrawerClose
              aria-label='Close admin navigation'
              className='grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-200'
            >
              <X size={18} />
            </DrawerClose>
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto py-3 [scrollbar-width:thin]'>
            <AdminNavigationList
              scope={scope}
              mode='mobile'
              onNavigate={() => onOpenChange(false)}
            />
          </div>

          <div className='border-t border-white/10 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]'>
            <AdminGlassPanel className='p-3'>
              <p className='text-[11px] text-slate-400'>Environment</p>
              <div className='mt-2 flex items-center gap-2 text-sm text-slate-100'>
                <span className='h-2 w-2 rounded-full bg-emerald-300' />
                Production
              </div>
              <p className='mt-2 text-[11px] text-slate-500'>Version 1.3.0</p>
            </AdminGlassPanel>

            <div className='mt-4 flex items-center gap-3 px-2'>
              <div className='grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white'>
                AD
              </div>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium text-white'>Admin User</p>
                <p className='text-xs text-slate-400'>Super Admin</p>
              </div>
              <ChevronDown size={15} className='text-slate-500' />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
