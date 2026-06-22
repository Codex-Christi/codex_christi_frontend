'use server';

import argon2 from 'argon2';
import { revalidatePath } from 'next/cache';
import {
  getActiveAdminUserByCodexUserId,
  getAdminUnlockRateLimit,
  recordAdminUnlockAttempt,
  writeAdminAuditLog,
} from '@/lib/admin/admin-auth-ledger';
import { requireMasterAdminAction } from '@/lib/admin/require-admin';
import {
  registerPayPalLedgerWebhookBinding,
  savePayPalLedgerWebhookBinding,
  syncPayPalLedgerWebhookEnvToDbBinding,
} from '@/lib/paypal/txLedger/adminPayPalLedgerWebhooks';

export type PayPalLedgerWebhookBindingActionState = {
  error: string | null;
  messageId: string | null;
  success: string | null;
};

export async function savePayPalLedgerWebhookBindingAction(
  _prevState: PayPalLedgerWebhookBindingActionState,
  formData: FormData,
): Promise<PayPalLedgerWebhookBindingActionState> {
  const intentValue = String(formData.get('intent') ?? '').trim();
  const intent =
    intentValue === 'register' ||
    intentValue === 'sync_env_to_db' ||
    intentValue === 'activate' ||
    intentValue === 'deactivate' ||
    intentValue === 'save'
      ? intentValue
      : null;
  const key = String(formData.get('key') ?? '').trim();
  const webhookId = String(formData.get('webhookId') ?? '').trim();
  const webhookUrl = String(formData.get('webhookUrl') ?? '').trim();
  const masterAdminPassword = String(formData.get('masterAdminPassword') ?? '');
  let actor: Awaited<ReturnType<typeof requireMasterAdminAction>> | null = null;

  try {
    if (!intent) {
      throw new Error('Choose a valid webhook binding action.');
    }

    actor = await requirePayPalWebhookMasterAdminStepUp({
      action: `shop.paypal_ledger_webhook_binding.${intent}`,
      password: masterAdminPassword,
      targetId: key,
    });

    const registerResult =
      intent === 'register'
        ? await registerPayPalLedgerWebhookBinding({
            actorAdminUserId: actor.adminUserId,
            actorCodexUserId: actor.userID,
            key,
            webhookUrl,
          })
        : null;
    const envSyncResult =
      intent === 'sync_env_to_db'
        ? await syncPayPalLedgerWebhookEnvToDbBinding({
            actorAdminUserId: actor.adminUserId,
            actorCodexUserId: actor.userID,
            key,
            webhookUrl,
          })
        : null;

    if (intent !== 'register' && intent !== 'sync_env_to_db') {
      await savePayPalLedgerWebhookBinding({
        actorAdminUserId: actor.adminUserId,
        actorCodexUserId: actor.userID,
        intent,
        key,
        webhookId,
        webhookUrl,
      });
    }

    await writeAdminAuditLog({
      actor,
      action: `shop.paypal_ledger_webhook_binding.${intent}`,
      targetType: 'paypalLedgerTransactionWebhookBinding',
      targetId: key,
      outcome: 'success',
      metadata: {
        intent,
        webhookIdConfigured: Boolean(webhookId),
        webhookUrlConfigured: Boolean(webhookUrl),
        ...(registerResult
          ? {
              envVarName: registerResult.envVarName,
              paypalAction: registerResult.paypalAction,
              paypalPaymentMode: registerResult.paypalPaymentMode,
              previousWebhookIdSource: registerResult.previousWebhookIdSource,
            }
          : envSyncResult
            ? {
                envVarName: envSyncResult.envVarName,
                syncedFromEnv: true,
              }
            : {}),
      },
    });

    revalidatePayPalLedgerWebhookPaths();

    return {
      error: null,
      messageId: crypto.randomUUID(),
      success: registerResult
        ? `${registerResult.label} webhook ${registerResult.paypalAction}; DB binding activated.`
        : envSyncResult
          ? `${envSyncResult.label} env value synced to DB and activated.`
          : intent === 'activate'
            ? 'DB binding activated.'
            : intent === 'deactivate'
              ? 'DB binding deactivated.'
              : 'DB binding saved.',
    };
  } catch (error) {
    if (actor) {
      await writeAdminAuditLog({
        actor,
        action: `shop.paypal_ledger_webhook_binding.${intent ?? 'unknown'}`,
        targetType: 'paypalLedgerTransactionWebhookBinding',
        targetId: key || undefined,
        outcome: 'failure',
        metadata: {
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
    }

    return {
      error: error instanceof Error ? error.message : 'Unable to update webhook binding.',
      messageId: crypto.randomUUID(),
      success: null,
    };
  }
}

async function requirePayPalWebhookMasterAdminStepUp({
  action,
  password,
  targetId,
}: {
  action: string;
  password: string;
  targetId: string;
}) {
  const admin = await requireMasterAdminAction();
  const adminUser = await getActiveAdminUserByCodexUserId(admin.userID);

  if (!adminUser) {
    throw new Error('Master admin account could not be loaded.');
  }

  const rateLimit = await getAdminUnlockRateLimit(adminUser.codexUserId);
  if (rateLimit.locked) {
    await writeAdminAuditLog({
      actor: admin,
      action,
      targetType: 'paypalLedgerTransactionWebhookBinding',
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
      actor: admin,
      action,
      targetType: 'paypalLedgerTransactionWebhookBinding',
      targetId,
      outcome: 'failure',
      metadata: { reason: 'invalid_step_up_password' },
    });
    throw new Error('Master admin password is incorrect.');
  }

  return admin;
}

function revalidatePayPalLedgerWebhookPaths() {
  revalidatePath('/admin/shop/paypal-webhooks');
  revalidatePath('/admin/shop');
}
