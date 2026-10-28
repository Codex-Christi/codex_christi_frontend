import 'server-only';

import argon2 from 'argon2';
import {
  getAdminUnlockRateLimit,
  recordAdminUnlockAttempt,
  writeAdminAuditLog,
  type AdminUserAuthRecord,
} from './admin-auth-ledger';
import { AdminCredentialError } from './admin-credential-work';
import { adminUnlockSchema } from '../formSchemas/admin-password';

export async function verifyAdminPassword(
  admin: AdminUserAuthRecord,
  password: string,
  purpose: 'unlock' | 'password_change' | 'master_transfer',
) {
  // Existing passwords keep their original rules and exact text.
  adminUnlockSchema.parse({ password });
  const limit = await getAdminUnlockRateLimit(admin.codexUserId);
  if (limit.locked)
    throw new AdminCredentialError(
      `Too many attempts. Try again in ${limit.retryAfterSeconds ?? 900} seconds.`,
      429,
    );
  const matches = await argon2.verify(admin.passwordHash, password).catch(() => false);
  if (!matches) {
    await recordAdminUnlockAttempt({
      adminUser: admin,
      success: false,
      failureReason: `${purpose}_invalid_password`,
    });
    await writeAdminAuditLog({
      actor: admin,
      action: `admin.${purpose}.failed`,
      targetType: 'adminUser',
      targetId: admin.id,
      outcome: 'failure',
    });
    throw new AdminCredentialError('Current admin unlock password is incorrect.', 400);
  }
}
