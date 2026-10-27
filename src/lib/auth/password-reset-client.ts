'use client';

import useAuthStore from '@/stores/authStore';
import { clearPrivateClientState, publishSessionChange } from './client-session';

type ResetInput = { email: string; otp: string; password: string };
type ResetResult = { success: true } | { success: false; error: string };

export async function resetPasswordAndSignOut(input: ResetInput): Promise<ResetResult> {
  try {
    const response = await fetch('/next-api/auth/password-reset', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(12_000),
    });
    const result: unknown = await response.json();
    if (
      !response.ok ||
      !result ||
      typeof result !== 'object' ||
      !('success' in result) ||
      result.success !== true
    )
      return {
        success: false,
        error:
          result &&
          typeof result === 'object' &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error.slice(0, 250)
            : 'Unable to change your password. Check the details and try again.',
      };
  } catch {
    return {
      success: false,
      error:
        'Unable to confirm the reset. Try signing in with your new password before requesting another reset.',
    };
  }
  // Cookie expiry is confirmed; full navigation also drops memory if storage cleanup fails.
  await clearPrivateClientState().catch(() => undefined);
  useAuthStore.getState().setSessionState({ isAuthenticated: false, user_id: null });
  publishSessionChange('logout');
  return { success: true };
}
