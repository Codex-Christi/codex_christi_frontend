import type { AuthState } from '@/stores/authStore';
import { isFreshServerSession, type AuthSessionState } from './session-snapshot';

export function accountViewState(
  state: Pick<AuthState, 'status' | 'accountOwnerId' | 'expiresAt'>,
  initialSession?: AuthSessionState,
  now = Date.now(),
) {
  const bootstrapped = state.status === 'unknown' && isFreshServerSession(initialSession, now);
  const expired =
    state.status === 'authenticated' && state.expiresAt !== null && state.expiresAt <= now;
  const status = bootstrapped ? 'authenticated' : expired ? 'unavailable' : state.status;
  const ownerId = bootstrapped ? initialSession!.user_id : state.accountOwnerId;
  const visible = status === 'authenticated';
  return {
    status,
    ownerId,
    visible,
    retainContent: visible || (status === 'unavailable' && Boolean(ownerId)),
  };
}
