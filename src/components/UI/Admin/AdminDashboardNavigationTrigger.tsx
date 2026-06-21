'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import AdminMobileNavigationDrawer from './dashboard/AdminMobileNavigationDrawer';

export default function AdminDashboardNavigationTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type='button'
        aria-label='Open admin navigation'
        onClick={() => setOpen(true)}
        className='inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-slate-100 shadow-[0_14px_34px_rgba(0,0,0,0.20)] transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100 supports-[backdrop-filter]:backdrop-blur-xl'
      >
        <Menu size={18} />
        <span>Admin Menu</span>
      </button>

      <AdminMobileNavigationDrawer
        scope='admin'
        open={open}
        onOpenChange={setOpen}
        desktopHidden={false}
      />
    </>
  );
}
