'use client';

import { useActionState, useState } from 'react';
import { Loader2, Mail, Search, X } from 'lucide-react';
import {
  cancelMasterAdminTransferAction,
  previewCodexChristiUserProfileAction,
  startMasterAdminTransferAction,
  type CodexUserProfilePreviewActionState,
  type MasterAdminTransferStartActionState,
  type MasterAdminTransferCancelActionState,
} from '@/app/admin/(dashboard)/admin-ops/actions';
import AdminCodexUserProfilePreview from './AdminCodexUserProfilePreview';
import { adminFieldClass } from './dashboard/AdminGlassPanel';

export default function AdminMasterTransferForm() {
  const [userId, setUserId] = useState('');
  const [cancelledId, setCancelledId] = useState<string | null>(null);
  const [state, invite, pending] = useActionState(startMasterAdminTransferAction, {
    error: null,
    challenge: null,
  } as MasterAdminTransferStartActionState);
  const [cancelState, cancel, cancelling] = useActionState(
    async (
      previous: MasterAdminTransferCancelActionState & { challengeId?: string },
      form: FormData,
    ) => {
      const result = await cancelMasterAdminTransferAction(previous, form);
      const challengeId = String(form.get('challengeId') ?? '');
      if (result.cancelled) setCancelledId(challengeId);
      return { ...result, challengeId };
    },
    { error: null } as MasterAdminTransferCancelActionState & { challengeId?: string },
  );
  const [preview, previewAction, previewing] = useActionState(
    previewCodexChristiUserProfileAction,
    { error: null, profile: null } as CodexUserProfilePreviewActionState,
  );
  const currentInvite =
    state.challenge && state.challenge.challengeId !== cancelledId ? state.challenge : null;

  return (
    <div className='space-y-4'>
      <form action={invite} className='space-y-3'>
        <label className='grid gap-1 text-xs font-medium text-slate-300'>
          Current unlock password
          <input
            name='currentAdminPassword'
            type='password'
            autoComplete='current-password'
            required
            minLength={1}
            maxLength={1024}
            className={adminFieldClass}
          />
        </label>
        <label className='grid gap-1 text-xs font-medium text-slate-300'>
          Recipient user ID
          <input
            name='targetCodexUserId'
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            required
            maxLength={36}
            className={adminFieldClass}
          />
        </label>
        <button
          type='submit'
          formAction={previewAction}
          formNoValidate
          disabled={previewing || pending || !userId.trim()}
          className='inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-cyan-300/25 px-3 text-xs text-cyan-100 disabled:opacity-60'
        >
          {previewing ? <Loader2 size={15} className='animate-spin' /> : <Search size={15} />}
          {previewing ? 'Checking...' : 'Preview Recipient'}
        </button>
        {preview.error ? (
          <p role='alert' className='text-sm text-rose-200'>
            {preview.error}
          </p>
        ) : null}
        {preview.profile?.id === userId.trim() ? (
          <AdminCodexUserProfilePreview profile={preview.profile} />
        ) : null}
        <label className='grid gap-1 text-xs font-medium text-slate-300'>
          Invitation email
          <input
            name='targetEmail'
            type='email'
            autoComplete='email'
            required
            maxLength={254}
            className={adminFieldClass}
          />
        </label>
        {state.error ? (
          <p role='alert' className='text-sm text-rose-200'>
            {state.error}
          </p>
        ) : null}
        <button
          type='submit'
          disabled={pending || cancelling}
          className='inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100 disabled:opacity-60'
        >
          {pending ? <Loader2 size={16} className='animate-spin' /> : <Mail size={16} />}
          {pending ? 'Sending...' : 'Send Ownership Invitation'}
        </button>
      </form>
      {currentInvite ? (
        <section
          aria-label='Pending ownership invitation'
          className='space-y-3 border-t border-white/10 pt-4 text-sm text-slate-300'
        >
          <p role='status'>
            Invitation sent. Your admin access stays active until the recipient accepts.
          </p>
          <dl className='grid gap-2 text-xs'>
            <div>
              <dt className='text-slate-400'>Recipient</dt>
              <dd className='break-all'>{currentInvite.targetCodexUserId}</dd>
            </div>
            <div>
              <dt className='text-slate-400'>Email</dt>
              <dd className='break-all'>{currentInvite.targetEmailHint}</dd>
            </div>
            <div>
              <dt className='text-slate-400'>Expires</dt>
              <dd>
                <time dateTime={new Date(currentInvite.expiresAt).toISOString()}>
                  {new Date(currentInvite.expiresAt).toLocaleString()}
                </time>
              </dd>
            </div>
          </dl>
          <form action={cancel}>
            <input type='hidden' name='challengeId' value={currentInvite.challengeId} />
            <button
              type='submit'
              disabled={cancelling || pending}
              className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-300/30 px-3 text-sm text-rose-200 disabled:opacity-60'
            >
              {cancelling ? <Loader2 size={16} className='animate-spin' /> : <X size={16} />}
              {cancelling ? 'Cancelling...' : 'Cancel Invitation'}
            </button>
          </form>
          {cancelState.challengeId === currentInvite.challengeId && cancelState.error ? (
            <p role='alert' className='text-sm text-rose-200'>
              {cancelState.error}
            </p>
          ) : null}
        </section>
      ) : null}
      {!currentInvite && cancelledId ? (
        <p role='status' className='text-sm text-emerald-200'>
          Invitation cancelled.
        </p>
      ) : null}
    </div>
  );
}
