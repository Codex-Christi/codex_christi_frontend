'use server';

import argon2 from 'argon2';
import { redirect } from 'next/navigation';
import { getAdminPasswordHash } from '@/lib/admin/admin-config';
import { sanitizeAdminReturnPath } from '@/lib/admin/admin-paths';
import {
  clearAdminUnlockAttempts,
  getAdminUnlockRateLimit,
  recordFailedAdminUnlock,
} from '@/lib/admin/admin-unlock-rate-limit';
import { createAdminSession } from '@/lib/admin/admin-session-server';
import { requirePrimaryAdminCandidate } from '@/lib/admin/require-admin';

export type AdminUnlockActionState = {
  error: string | null;
};

export async function unlockAdminAction(
  _prevState: AdminUnlockActionState,
  formData: FormData,
): Promise<AdminUnlockActionState> {
  const nextPath = sanitizeAdminReturnPath(String(formData.get('next') ?? ''), '/admin');
  const password = String(formData.get('password') ?? '');
  const { userID } = await requirePrimaryAdminCandidate({
    returnPath: `/admin/unlock?next=${encodeURIComponent(nextPath)}`,
  });
  const rateLimit = getAdminUnlockRateLimit(userID);

  if (rateLimit.locked) {
    return {
      error: `Too many failed attempts. Try again in ${rateLimit.retryAfterSeconds ?? 900} seconds.`,
    };
  }

  if (!password) {
    return {
      error: 'Enter the admin password.',
    };
  }

  const adminPasswordHash = getAdminPasswordHash();

  if (!adminPasswordHash) {
    return {
      error: 'Admin unlock is not configured.',
    };
  }

  const passwordMatches = await argon2.verify(adminPasswordHash, password);

  if (!passwordMatches) {
    const updatedRateLimit = recordFailedAdminUnlock(userID);
    const remainingAttempts = updatedRateLimit.remainingAttempts ?? 0;

    return {
      error:
        remainingAttempts > 0
          ? `Invalid admin password. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
          : 'Invalid admin password. Admin unlock is temporarily locked.',
    };
  }

  clearAdminUnlockAttempts(userID);
  await createAdminSession(userID);

  redirect(nextPath);
}

