'use client';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { accountViewState } from '@/lib/auth/account-view-state';
import type { AuthSessionState } from '@/lib/auth/session-snapshot';

export default function HistoryOwnerBoundary({
  session,
  children,
}: {
  session: AuthSessionState;
  children: ReactNode;
}) {
  const state = useAuthStore();
  const router = useRouter();
  const view = accountViewState(state, session);
  const matches = view.visible && view.ownerId === session.user_id;
  useEffect(() => {
    if (view.visible && !matches) router.refresh();
  }, [matches, router, view.visible]);
  return matches ? children : <p role='status'>Checking account access...</p>;
}
