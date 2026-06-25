'use client';

import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import AdminDashboardBackground from './AdminDashboardBackground';
import AdminDashboardMobileDrawer from './AdminDashboardMobileDrawer';
import AdminDashboardSidebar from './AdminDashboardSidebar';
import AdminDashboardTopBar from './AdminDashboardTopBar';
import {
  getAdminDashboardPageConfig,
  getPermittedAdminNavigationGroups,
} from './adminDashboardNavigation';
import type { AdminDashboardShellProps } from './adminDashboardTypes';

export default function AdminDashboardShell({
  access,
  children,
  identity,
}: AdminDashboardShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const pageConfig = getAdminDashboardPageConfig(pathname);
  const navigationGroups = useMemo(() => getPermittedAdminNavigationGroups(access), [access]);

  return (
    <main className='relative isolate grid min-h-dvh overflow-x-hidden bg-[#141923] text-slate-50'>
      <AdminDashboardBackground />

      <AdminDashboardMobileDrawer
        activeSection={pageConfig.section}
        identity={identity}
        navigationGroups={navigationGroups}
        open={mobileNavigationOpen}
        onOpenChange={setMobileNavigationOpen}
      />

      <div className='relative z-10 col-start-1 row-start-1 min-h-dvh xl:pl-[250px]'>
        <AdminDashboardSidebar
          activeSection={pageConfig.section}
          identity={identity}
          navigationGroups={navigationGroups}
        />

        <section className='min-w-0 xl:min-h-dvh xl:pt-20'>
          <AdminDashboardTopBar
            title={pageConfig.title}
            subtitle={pageConfig.subtitle}
            searchPlaceholder={pageConfig.searchPlaceholder}
            onOpenMobileNavigation={() => setMobileNavigationOpen(true)}
          />

          {children}
        </section>
      </div>
    </main>
  );
}
