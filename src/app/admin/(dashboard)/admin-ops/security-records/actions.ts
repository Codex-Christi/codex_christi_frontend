'use server';

import argon2 from 'argon2';
import { revalidatePath } from 'next/cache';
import {
  deleteAdminAuditLogsByCreatedAtRange,
  getActiveAdminUserByCodexUserId,
  getAdminUnlockRateLimit,
  recordAdminUnlockAttempt,
  writeAdminAuditLog,
} from '@/lib/admin/admin-auth-ledger';
import { ADMIN_OPS_LEDGER_MINIMUM_STORAGE_RETENTION_POLICY } from '@/lib/admin/admin-ops-ledger-maintenance-core';
import { runAdminOpsLedgerPrune } from '@/lib/admin/admin-ops-ledger-maintenance';
import { requireMasterAdminAction } from '@/lib/admin/require-admin';

export type ClearAdminAuditLogsActionState = {
  error: string | null;
  success: string | null;
  deletedCount: number | null;
};

export type RunAdminOpsLedgerPruneActionState = {
  deleted:
    | {
        auditLogs: number;
        masterTransferChallenges: number;
        unlockAttempts: number;
      }
    | null;
  error: string | null;
  success: string | null;
};

type MasterMaintenanceActor = Awaited<ReturnType<typeof requireMasterAdminAction>>;

export async function clearAdminAuditLogsByTimeRangeAction(
  _prevState: ClearAdminAuditLogsActionState,
  formData: FormData,
): Promise<ClearAdminAuditLogsActionState> {
  const from = parseLocalDateTime(
    String(formData.get('from') ?? ''),
    String(formData.get('timeZoneOffsetMinutes') ?? ''),
  );
  const to = parseLocalDateTime(
    String(formData.get('to') ?? ''),
    String(formData.get('timeZoneOffsetMinutes') ?? ''),
  );

  if (!from || !to) {
    return {
      error: 'Choose a valid start and end time.',
      success: null,
      deletedCount: null,
    };
  }

  if (from.getTime() >= to.getTime()) {
    return {
      error: 'The start time must be before the end time.',
      success: null,
      deletedCount: null,
    };
  }

  const auth = await verifyMasterAdminMaintenancePassword({
    action: 'admin.audit_logs.cleared',
    password: String(formData.get('password') ?? ''),
    targetId: 'createdAtRange',
    targetType: 'adminAuditLog',
  }).catch((error) => ({
    error: error instanceof Error ? error.message : 'Master admin authorization required.',
  }));

  if ('error' in auth) {
    return {
      error: auth.error,
      success: null,
      deletedCount: null,
    };
  }

  try {
    const deletedCount = await deleteAdminAuditLogsByCreatedAtRange({ from, to });

    await writeAdminAuditLog({
      actor: auth.actor,
      action: 'admin.audit_logs.cleared',
      targetType: 'adminAuditLog',
      targetId: 'createdAtRange',
      outcome: 'success',
      metadata: {
        deletedCount,
        from: from.toISOString(),
        to: to.toISOString(),
        preservedClearAuditEvents: true,
      },
    });

    revalidateSecurityRecordsPaths();

    return {
      error: null,
      success: `${deletedCount} audit log${deletedCount === 1 ? '' : 's'} cleared.`,
      deletedCount,
    };
  } catch (error) {
    await writeAdminAuditLog({
      actor: auth.actor,
      action: 'admin.audit_logs.clear_failed',
      targetType: 'adminAuditLog',
      targetId: 'createdAtRange',
      outcome: 'failure',
      metadata: {
        from: from.toISOString(),
        to: to.toISOString(),
        reason: error instanceof Error ? error.message : 'unknown_error',
      },
    });

    return {
      error: 'Unable to clear audit logs for that range.',
      success: null,
      deletedCount: null,
    };
  }
}

export async function runMinimumStorageLedgerCleanupAction(
  _prevState: RunAdminOpsLedgerPruneActionState,
  formData: FormData,
): Promise<RunAdminOpsLedgerPruneActionState> {
  const auth = await verifyMasterAdminMaintenancePassword({
    action: 'admin.security_records.minimum_storage_prune',
    password: String(formData.get('password') ?? ''),
    targetId: 'minimum-storage',
    targetType: 'adminOpsLedgerMaintenance',
  }).catch((error) => ({
    error: error instanceof Error ? error.message : 'Master admin authorization required.',
  }));

  if ('error' in auth) {
    return {
      deleted: null,
      error: auth.error,
      success: null,
    };
  }

  try {
    const result = await runAdminOpsLedgerPrune({
      policy: ADMIN_OPS_LEDGER_MINIMUM_STORAGE_RETENTION_POLICY,
    });

    await writeAdminAuditLog({
      actor: auth.actor,
      action: 'admin.security_records.minimum_storage_prune',
      targetType: 'adminOpsLedgerMaintenance',
      targetId: 'minimum-storage',
      outcome: 'success',
      metadata: {
        cutoffs: {
          auditLogCreatedBefore: result.cutoffs.auditLogCreatedBefore.toISOString(),
          masterTransferChallengeCreatedBefore:
            result.cutoffs.masterTransferChallengeCreatedBefore.toISOString(),
          unlockAttemptCreatedBefore: result.cutoffs.unlockAttemptCreatedBefore.toISOString(),
        },
        deleted: result.deleted,
        policy: result.policy,
      },
    });

    revalidateSecurityRecordsPaths();

    return {
      deleted: result.deleted,
      error: null,
      success: `${getDeletedTotal(result.deleted)} security record${getDeletedTotal(result.deleted) === 1 ? '' : 's'} pruned.`,
    };
  } catch (error) {
    await writeAdminAuditLog({
      actor: auth.actor,
      action: 'admin.security_records.minimum_storage_prune_failed',
      targetType: 'adminOpsLedgerMaintenance',
      targetId: 'minimum-storage',
      outcome: 'failure',
      metadata: {
        reason: error instanceof Error ? error.message : 'unknown_error',
      },
    });

    return {
      deleted: null,
      error: 'Unable to run minimum-storage cleanup.',
      success: null,
    };
  }
}

async function verifyMasterAdminMaintenancePassword({
  action,
  password,
  targetId,
  targetType,
}: {
  action: string;
  password: string;
  targetId: string;
  targetType: string;
}): Promise<{ actor: MasterMaintenanceActor }> {
  const actor = await requireMasterAdminAction();
  const adminUser = await getActiveAdminUserByCodexUserId(actor.userID);

  if (!adminUser) {
    throw new Error('Master admin account could not be loaded.');
  }

  const rateLimit = await getAdminUnlockRateLimit(adminUser.codexUserId);

  if (rateLimit.locked) {
    await writeAdminAuditLog({
      actor,
      action,
      targetType,
      targetId,
      outcome: 'blocked',
      metadata: { reason: 'step_up_rate_limited' },
    });

    throw new Error(
      `Too many failed password attempts. Try again in ${rateLimit.retryAfterSeconds ?? 900} seconds.`,
    );
  }

  if (!password.trim()) {
    throw new Error('Master admin password is required.');
  }

  const passwordMatches = await argon2.verify(adminUser.passwordHash, password).catch(() => false);

  await recordAdminUnlockAttempt({
    adminUser,
    success: passwordMatches,
    failureReason: passwordMatches ? undefined : 'invalid_step_up_password',
  });

  if (!passwordMatches) {
    await writeAdminAuditLog({
      actor,
      action,
      targetType,
      targetId,
      outcome: 'failure',
      metadata: { reason: 'invalid_step_up_password' },
    });

    throw new Error('Master admin password is incorrect.');
  }

  return { actor };
}

function revalidateSecurityRecordsPaths() {
  revalidatePath('/admin/admin-ops/security-records');
  revalidatePath('/admin/admin-ops');
  revalidatePath('/admin');
}

function parseLocalDateTime(value: string, timeZoneOffsetMinutesValue: string) {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const offsetMinutes = Number.parseInt(timeZoneOffsetMinutesValue, 10);
  const hasUsableOffset = Number.isInteger(offsetMinutes) && Math.abs(offsetMinutes) <= 14 * 60;
  const [, year, month, day, hour, minute, second = '0'] = match;
  const timestamp =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ) + (hasUsableOffset ? offsetMinutes * 60 * 1000 : 0);
  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getDeletedTotal(deleted: NonNullable<RunAdminOpsLedgerPruneActionState['deleted']>) {
  return deleted.auditLogs + deleted.masterTransferChallenges + deleted.unlockAttempts;
}
