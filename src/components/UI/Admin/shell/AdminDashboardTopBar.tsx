import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpLeft, ChevronDown, Lock, Menu, RefreshCw, Search } from 'lucide-react';

type AdminDashboardTopBarProps = {
  onOpenMobileNavigation: () => void;
  searchPlaceholder: string;
  subtitle: string;
  title: string;
};

export default function AdminDashboardTopBar({
  onOpenMobileNavigation,
  searchPlaceholder,
  subtitle,
  title,
}: AdminDashboardTopBarProps) {
  return (
    <header className='sticky top-0 z-40 flex min-h-20 flex-wrap items-center gap-3 border-b border-white/[0.055] bg-[rgba(20,25,35,0.80)] px-3 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.13)] supports-[backdrop-filter]:backdrop-blur-[18px] supports-[backdrop-filter]:backdrop-saturate-150 sm:gap-4 sm:px-5 xl:fixed xl:left-[250px] xl:right-0 xl:top-0 xl:h-20 xl:flex-nowrap'>
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

      <div className='order-last flex min-w-full flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-slate-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:order-none sm:min-w-[320px] lg:min-w-[280px] xl:min-w-[320px] xl:max-w-[470px]'>
        <Search size={16} />
        <span className='truncate text-sm'>{searchPlaceholder}</span>
        <kbd className='ml-auto rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-slate-400'>
          /
        </kbd>
      </div>

      <div className='ml-auto flex items-center gap-2 sm:gap-3'>
        <span className='hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-slate-100 xl:inline-flex'>
          <span className='h-2 w-2 rounded-full bg-emerald-300' />
          Production
          <ChevronDown size={14} />
        </span>

        <div className='hidden text-sm xl:block'>
          <p className='text-slate-300'>Admin Health</p>
          <p className='text-emerald-300'>Good</p>
        </div>

        <RefreshCw className='hidden text-emerald-300 xl:block' size={22} />

        <Link
          href='/'
          aria-label='Open site root'
          title='Site root'
          className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-sm font-semibold text-slate-200 transition hover:border-cyan-300/25 hover:bg-white/[0.06] hover:text-cyan-100 sm:inline-flex sm:w-auto sm:gap-2 sm:px-3'
        >
          <ArrowUpLeft size={17} />
          <span className='hidden sm:inline'>Site root</span>
        </Link>

        <Link
          href='/admin/logout'
          aria-label='Lock admin session'
          title='Lock admin session'
          className='grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-200 transition hover:border-cyan-300/25 hover:bg-white/[0.06] hover:text-cyan-100'
        >
          <Lock size={17} />
        </Link>

        <button
          type='button'
          aria-label='Notifications'
          className='relative grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-200'
        >
          <Image
            src='/media/img/general/notifications-icon.svg'
            alt=''
            width={17}
            height={17}
            className='h-[17px] w-[17px] opacity-90'
          />
          <span className='sr-only'>Notifications</span>
          <span className='absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-rose-500 text-[10px] font-bold text-white'>
            8
          </span>
        </button>

        <div className='hidden h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white xl:grid'>
          AD
        </div>
      </div>
    </header>
  );
}
