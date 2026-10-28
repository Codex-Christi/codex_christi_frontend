'use client';

import { useRef, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { postAdminAuth } from '@/lib/admin/admin-auth-client';
import { buildAdminUnlockPath } from '@/lib/admin/admin-paths';
import errorToast from '@/lib/error-toast';

export default function AdminLockButton() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  async function lock() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const result = await postAdminAuth('lock');
    if (result.success) {
      window.location.replace(
        buildAdminUnlockPath(`${window.location.pathname}${window.location.search}`),
      );
      return;
    }
    errorToast({ message: result.error });
    busy.current = false;
    setPending(false);
  }
  return (
    <button
      type='button'
      onClick={lock}
      disabled={pending}
      aria-label='Lock admin session'
      title='Lock admin session'
      className='grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-slate-200 transition hover:border-cyan-300/25 hover:bg-white/[0.06] hover:text-cyan-100 disabled:cursor-wait disabled:opacity-60'
    >
      {pending ? <Loader2 size={17} className='animate-spin' /> : <Lock size={17} />}
    </button>
  );
}
