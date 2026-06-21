'use client';

import { useState, type ReactNode } from 'react';
import AdminAmbientSlideshow from './dashboard/AdminAmbientSlideshow';
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
    <main className='relative isolate min-h-dvh overflow-x-hidden bg-[#141923] text-slate-50'>
      <AdminAmbientSlideshow />

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
