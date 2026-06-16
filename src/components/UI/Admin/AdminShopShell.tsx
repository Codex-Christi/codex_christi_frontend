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
    <main className='relative min-h-dvh overflow-hidden bg-transparent text-slate-50'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_74%_18%,rgba(14,165,233,0.15),transparent_22%),linear-gradient(180deg,rgba(2,6,23,0.68),rgba(2,6,23,0.91))]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 z-0 bg-slate-950/18 supports-[backdrop-filter]:backdrop-blur-[1.5px]'
      />

      <AdminMobileNavigationDrawer
        scope={scope}
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
      />

      <div className='relative z-10 grid min-h-dvh lg:grid-cols-[250px_minmax(0,1fr)]'>
        <AdminSidebar scope={scope} />

        <section className='min-w-0'>
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
