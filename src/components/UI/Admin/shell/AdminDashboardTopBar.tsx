import Link from 'next/link';
import { ArrowUpLeft, Menu } from 'lucide-react';
import AdminLockButton from '../AdminLockButton';
import styles from './AdminDashboardShell.module.css';

type AdminDashboardTopBarProps = {
  onOpenMobileNavigation: () => void;
  searchPlaceholder: string;
  subtitle: string;
  title: string;
};

export default function AdminDashboardTopBar({
  onOpenMobileNavigation,
  subtitle,
  title,
}: AdminDashboardTopBarProps) {
  return (
    <header className={styles.topBar}>
      <button
        type='button'
        aria-label='Open admin navigation'
        onClick={onOpenMobileNavigation}
        className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-200 xl:hidden'
      >
        <Menu size={18} />
      </button>

      <div className='min-w-0 flex-1 sm:min-w-[210px] sm:flex-none'>
        <h1 className='truncate text-base font-semibold text-white sm:text-lg'>{title}</h1>
        <p className='truncate text-xs text-slate-400'>{subtitle}</p>
      </div>

      <div className='ml-auto flex items-center gap-2 sm:gap-3'>
        <Link
          href='/'
          aria-label='Open site root'
          title='Site root'
          className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-sm font-semibold text-slate-200 transition hover:border-cyan-300/25 hover:bg-white/[0.06] hover:text-cyan-100 sm:inline-flex sm:w-auto sm:gap-2 sm:px-3'
        >
          <ArrowUpLeft size={17} />
          <span className='hidden sm:inline'>Site root</span>
        </Link>

        <AdminLockButton />
      </div>
    </header>
  );
}
