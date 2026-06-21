'use client';

import { useState, type ReactNode } from 'react';
import AdminMobileNavigationDrawer from './dashboard/AdminMobileNavigationDrawer';
import AdminSidebar from './dashboard/AdminSidebar';
import AdminTopBar from './dashboard/AdminTopBar';
import type { AdminShopScope } from './dashboard/adminShopDashboardTypes';

type AdminShopShellProps = {
  scope: AdminShopScope;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function AdminShopShell({ scope, title, subtitle, children }: AdminShopShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <main className='relative min-h-dvh overflow-x-hidden bg-[#141923] text-slate-50'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_74%_18%,rgba(14,165,233,0.10),transparent_23%),linear-gradient(180deg,rgba(30,35,47,0.78),rgba(16,21,31,0.94))]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-0 bg-[rgba(255,248,232,0.018)] supports-[backdrop-filter]:backdrop-blur-[1.5px]'
      />

      <AdminMobileNavigationDrawer
        scope={scope}
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
      />

      <div className='relative z-10 min-h-dvh lg:pl-[250px]'>
        <AdminSidebar scope={scope} />

        <section className='min-w-0 lg:min-h-dvh lg:pt-20'>
          <AdminTopBar
            title={title}
            subtitle={subtitle}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />

          {children}
        </section>
      </div>
    </main>
  );
}
