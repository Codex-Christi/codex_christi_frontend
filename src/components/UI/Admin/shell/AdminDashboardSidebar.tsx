import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import AdminGlassPanel from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import AdminDashboardNavigationList from './AdminDashboardNavigationList';
import styles from './AdminDashboardShell.module.css';
import type {
  AdminDashboardIdentity,
  AdminDashboardNavigationGroup,
  AdminDashboardSection,
} from './adminDashboardTypes';

type AdminDashboardSidebarProps = {
  activeSection: AdminDashboardSection;
  identity: AdminDashboardIdentity | null;
  navigationGroups: AdminDashboardNavigationGroup[];
};

export default function AdminDashboardSidebar({
  activeSection,
  identity,
  navigationGroups,
}: AdminDashboardSidebarProps) {
  return (
    <aside className={styles.desktopSidebar}>
      <div className='flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden'>
        <Link
          href='/admin'
          className='flex h-20 min-w-0 items-center gap-2 border-b border-white/10 px-4'
        >
          <Image
            src='/media/img/general/logo.svg'
            alt='Codex Christi'
            width={146}
            height={63}
            priority
            className='h-11 min-w-0 max-w-[136px] shrink'
          />
          <span className='shrink-0 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-cyan-100'>
            Admin
          </span>
        </Link>

        <AdminDashboardNavigationList
          activeSection={activeSection}
          groups={navigationGroups}
          mode='desktop'
        />

        <div className='hidden min-w-0 shrink-0 overflow-x-hidden border-t border-white/10 p-3 xl:block'>
          <AdminGlassPanel className='p-3'>
            <p className='text-[11px] text-slate-400'>Admin session</p>
            <div className='mt-2 flex items-center gap-2 text-sm text-slate-100'>
              <span className='h-2 w-2 rounded-full bg-emerald-300' />
              {identity?.role ?? 'Locked'}
            </div>
            <p className='mt-2 truncate text-[11px] text-slate-400'>
              {identity?.email ?? identity?.userID ?? 'Admin user'}
            </p>
          </AdminGlassPanel>

          <div className='mt-4 flex min-w-0 items-center gap-3 px-2'>
            <div className='grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold'>
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
    </aside>
  );
}
