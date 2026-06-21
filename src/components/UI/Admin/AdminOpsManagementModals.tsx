'use client';

import type { ReactNode } from 'react';
import { KeyRound, ShieldPlus, UserRoundCog } from 'lucide-react';
import AdminMasterTransferForm from '@/components/UI/Admin/AdminMasterTransferForm';
import AdminUserProvisioningForm from '@/components/UI/Admin/AdminUserProvisioningForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/UI/primitives/dialog';
import { cn } from '@/lib/utils';
import AdminGlassPanel from './dashboard/AdminGlassPanel';

export default function AdminOpsManagementModals() {
  return (
    <section className='grid items-stretch gap-4 md:grid-cols-2'>
      <AdminOpsModalCard
        tone='cyan'
        icon={ShieldPlus}
        eyebrow='Access'
        title='Operational Admins'
        description='Create or update admin access, status, role, and product scopes.'
        actionLabel='Open Admin Form'
        dialogTitle='Operational Admin Access'
        dialogDescription='Create a new operational admin or update an existing admin by Codex Christi user ID.'
      >
        <AdminUserProvisioningForm />
      </AdminOpsModalCard>

      <AdminOpsModalCard
        tone='rose'
        icon={KeyRound}
        eyebrow='Master'
        title='Master Transfer'
        description='Move master privileges after password verification and OTP confirmation.'
        actionLabel='Open Transfer Form'
        dialogTitle='Master Admin Transfer'
        dialogDescription='Transfer master admin privileges to another Codex Christi account.'
      >
        <AdminMasterTransferForm />
      </AdminOpsModalCard>
    </section>
  );
}

function AdminOpsModalCard({
  tone,
  icon: Icon,
  eyebrow,
  title,
  description,
  actionLabel,
  dialogTitle,
  dialogDescription,
  children,
}: {
  tone: 'cyan' | 'rose';
  icon: typeof UserRoundCog;
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  dialogTitle: string;
  dialogDescription: string;
  children: ReactNode;
}) {
  const toneClass = {
    cyan: {
      icon: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
      button: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15',
      eyebrow: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
    },
    rose: {
      icon: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
      button: 'border-rose-300/25 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15',
      eyebrow: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
    },
  }[tone];

  return (
    <Dialog>
      <AdminGlassPanel className='flex min-h-[190px] flex-col justify-between p-4 sm:p-5'>
        <div className='flex items-start justify-between gap-4'>
          <div className='min-w-0'>
            <div
              className={cn(
                'mb-3 inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em]',
                toneClass.eyebrow,
              )}
            >
              <Icon size={14} />
              {eyebrow}
            </div>
            <h2 className='text-base font-semibold text-white'>{title}</h2>
            <p className='mt-2 max-w-xl text-sm leading-6 text-slate-400'>{description}</p>
          </div>
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-lg border',
              toneClass.icon,
            )}
          >
            <Icon size={20} />
          </span>
        </div>

        <DialogTrigger asChild>
          <button
            type='button'
            className={cn(
              'mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition',
              toneClass.button,
            )}
          >
            <UserRoundCog size={16} />
            {actionLabel}
          </button>
        </DialogTrigger>
      </AdminGlassPanel>

      <DialogContent className='max-h-[88dvh] w-[min(94vw,720px)] overflow-y-auto rounded-lg border border-white/10 bg-slate-950/95 p-5 text-slate-50 shadow-2xl shadow-black/70 backdrop-blur-xl sm:p-6'>
        <DialogHeader>
          <DialogTitle className='text-white'>{dialogTitle}</DialogTitle>
          <DialogDescription className='text-slate-400'>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className='mt-2'>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
