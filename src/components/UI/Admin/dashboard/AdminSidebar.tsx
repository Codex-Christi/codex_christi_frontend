import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import AdminGlassPanel from './AdminGlassPanel';
import AdminNavigationList from './AdminNavigationList';
import type { AdminScope } from './adminDashboardTypes';

export default function AdminSidebar({ scope }: { scope: AdminScope }) {
  return (
    <aside className='hidden border-r border-white/10 bg-slate-950/58 supports-[backdrop-filter]:backdrop-blur-xl lg:block lg:min-h-dvh'>
      <div className='flex h-full flex-col'>
        <Link href='/admin/shop' className='flex h-20 items-center gap-3 border-b border-white/10 px-5'>
          <Image
            src='/media/img/general/logo.svg'
            alt='Codex Christi'
            width={146}
            height={63}
            priority
            className='h-11 w-auto'
          />
          <span className='rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100'>
            Admin
          </span>
        </Link>

        <AdminNavigationList scope={scope} mode='desktop' />

        <div className='hidden border-t border-white/10 p-3 lg:block'>
          <AdminGlassPanel className='p-3'>
            <p className='text-[11px] text-slate-400'>Environment</p>
            <div className='mt-2 flex items-center gap-2 text-sm text-slate-100'>
              <span className='h-2 w-2 rounded-full bg-emerald-300' />
              Production
            </div>
            <p className='mt-2 text-[11px] text-slate-500'>Version 1.3.0</p>
          </AdminGlassPanel>

          <div className='mt-4 flex items-center gap-3 px-2'>
            <div className='grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-semibold'>
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
    </aside>
  );
}
