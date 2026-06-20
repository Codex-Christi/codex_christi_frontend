'use server';

import { revalidatePath } from 'next/cache';
import {
  upsertAdminUserFromDashboard,
  writeAdminAuditLog,
} from '@/lib/admin/admin-auth-ledger';
import {
  isMasterAdminRole,
  normalizeAdminRole,
  normalizeAdminScopes,
  type AdminStatus,
} from '@/lib/admin/admin-config';
import { requireMasterAdminAction } from '@/lib/admin/require-admin';

export type AdminUserProvisionActionState = {
  error: string | null;
  success: string | null;
};

export async function provisionAdminUserAction(
  _prevState: AdminUserProvisionActionState,
  formData: FormData,
): Promise<AdminUserProvisionActionState> {
  const actor = await requireMasterAdminAction();
  const codexUserId = String(formData.get('codexUserId') ?? '').trim();
  const email = normalizeOptionalString(formData.get('email'))?.toLowerCase() ?? null;
  const displayName = normalizeOptionalString(formData.get('displayName')) ?? null;
  const password = normalizeOptionalString(formData.get('password')) ?? null;
  const role = normalizeAdminRole(String(formData.get('role') ?? ''));
  const scopes = normalizeAdminScopes(formData.getAll('scopes').map(String));
  const status = normalizeAdminStatus(String(formData.get('status') ?? 'active'));

  if (!codexUserId) {
    return { error: 'Enter the Codex user ID.', success: null };
  }

  if (!role) {
    return { error: 'Choose a valid admin role.', success: null };
  }

  if (isMasterAdminRole(role)) {
    return { error: 'The master admin is managed by the master-admin creation script.', success: null };
  }

  if (!scopes.length) {
    return { error: 'Choose at least one admin scope.', success: null };
  }

  if (codexUserId === actor.userID) {
    return { error: 'Use the master-admin creation script to update your own master access.', success: null };
  }

  try {
    const result = await upsertAdminUserFromDashboard({
      actor,
      input: {
        codexUserId,
        email,
        displayName,
        password,
        role,
        scopes,
        status,
      },
    });

    revalidatePath('/admin');

    return {
      error: null,
      success: `${result.adminUser.email ?? result.adminUser.codexUserId} ${result.action}.`,
    };
  } catch (error) {
    await writeAdminAuditLog({
      actor,
      action: 'admin.user.save_failed',
      targetType: 'adminUser',
      targetId: codexUserId || undefined,
      outcome: 'failure',
      metadata: {
        codexUserId,
        email,
        role,
        scopes,
        status,
        reason: error instanceof Error ? error.message : 'unknown_error',
      },
    });

    return {
      error:
        error instanceof Error && error.message.includes('requires an unlock password')
          ? error.message
          : 'Unable to save admin user. Check that the Codex user ID and email are not already assigned.',
      success: null,
    };
  }
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : '';

  return text || null;
}

function normalizeAdminStatus(value: string): AdminStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}
