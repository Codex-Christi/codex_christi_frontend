'use server';

import { revalidatePath } from 'next/cache';
import {
  deleteAdminAuditLogsByCreatedAtRange,
  writeAdminAuditLog,
} from '@/lib/admin/admin-auth-ledger';
import { requireMasterAdminAction } from '@/lib/admin/require-admin';

export type ClearAdminAuditLogsActionState = {
  error: string | null;
  success: string | null;
  deletedCount: number | null;
};

export async function clearAdminAuditLogsByTimeRangeAction(
  _prevState: ClearAdminAuditLogsActionState,
  formData: FormData,
): Promise<ClearAdminAuditLogsActionState> {
  const auth = await getMasterAdminActionContext();
  if (!auth.ok) {
    return {
      error: auth.error,
      success: null,
      deletedCount: null,
    };
  }

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

    revalidatePath('/admin/admin-ops/audit-logs');
    revalidatePath('/admin/admin-ops');

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

type MasterAdminActionContext =
  | { ok: true; actor: Awaited<ReturnType<typeof requireMasterAdminAction>> }
  | { ok: false; error: string };

async function getMasterAdminActionContext(): Promise<MasterAdminActionContext> {
  try {
    return { ok: true, actor: await requireMasterAdminAction() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Master admin authorization required.',
    };
  }
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
