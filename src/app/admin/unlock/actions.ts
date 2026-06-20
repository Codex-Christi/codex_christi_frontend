'use server';

import argon2 from 'argon2';
import { redirect } from 'next/navigation';
import {
  getAdminUnlockRateLimit,
  recordAdminUnlockAttempt,
  touchAdminUserUnlockedAt,
  writeAdminAuditLog,
} from '@/lib/admin/admin-auth-ledger';
import { sanitizeAdminReturnPath } from '@/lib/admin/admin-paths';
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
  const adminUser = await requirePrimaryAdminCandidate({
    returnPath: `/admin/unlock?next=${encodeURIComponent(nextPath)}`,
  });
  const rateLimit = await getAdminUnlockRateLimit(adminUser.codexUserId);

  if (rateLimit.locked) {
    await writeAdminAuditLog({
      actor: adminUser,
      action: 'admin.unlock.blocked',
      targetType: 'adminUser',
      targetId: adminUser.id,
      outcome: 'blocked',
      metadata: { reason: 'rate_limited' },
    });

    return {
      error: `Too many failed attempts. Try again in ${rateLimit.retryAfterSeconds ?? 900} seconds.`,
    };
  }

  if (!password) {
    return {
      error: 'Enter the admin password.',
    };
  }

  const passwordMatches = await argon2
    .verify(adminUser.passwordHash, password)
    .catch(() => false);

  if (!passwordMatches) {
    await recordAdminUnlockAttempt({
      adminUser,
      success: false,
      failureReason: 'invalid_password',
    });
    await writeAdminAuditLog({
      actor: adminUser,
      action: 'admin.unlock.failed',
      targetType: 'adminUser',
      targetId: adminUser.id,
      outcome: 'failure',
      metadata: { reason: 'invalid_password' },
    });

    const updatedRateLimit = await getAdminUnlockRateLimit(adminUser.codexUserId);
    const remainingAttempts = updatedRateLimit.remainingAttempts ?? 0;

    return {
      error:
        remainingAttempts > 0
          ? `Invalid admin password. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.`
          : 'Invalid admin password. Admin unlock is temporarily locked.',
    };
  }

  await touchAdminUserUnlockedAt(adminUser.id);
  await writeAdminAuditLog({
    actor: adminUser,
    action: 'admin.unlock.success',
    targetType: 'adminUser',
    targetId: adminUser.id,
    outcome: 'success',
  });
  await createAdminSession({
    userID: adminUser.codexUserId,
    role: adminUser.role,
    scopes: adminUser.scopes,
    sessionVersion: adminUser.sessionVersion,
  });

  redirect(nextPath);
}
