'use server';

import argon2 from 'argon2';
import { revalidatePath } from 'next/cache';
import {
  getActiveAdminUserByCodexUserId,
  getAdminUnlockRateLimit,
  recordAdminUnlockAttempt,
  writeAdminAuditLog,
} from '@/lib/admin/admin-auth-ledger';
import { requireAdminAction, requireMasterAdminAction } from '@/lib/admin/require-admin';
import {
  resendAdminRecoveryNotification,
  suppressAdminRecoveryNotification,
} from '@/lib/paypal/txLedger/adminNotificationOutbox';
import { resendCustomerNotification } from '@/lib/paypal/txLedger/customerNotificationOutbox';
import {
  runPayPalRecoveryScanner,
  runSelectedPayPalRecoveryScanner,
  type PayPalRecoveryScannerRunResult,
} from '@/lib/paypal/txLedger/recoveryScanner';
import { runPaidFulfillmentProcessing } from '@/lib/paypal/txLedger/runPaidFulfillmentProcessing';
import { isAcceptedDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/fulfillmentProcessResponse';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { registerAcceptedMerchizeFulfillmentProcess } from '@/lib/merchizeFulfillmentOps/registerAcceptedMerchizeFulfillmentProcess';
import { syncMerchizeFulfillmentOrder } from '@/lib/merchizeFulfillmentOps/syncMerchizeFulfillmentOrder';
import { syncMerchizeFulfillmentOperationalSnapshots } from '@/lib/merchizeFulfillmentOps/syncMerchizeFulfillmentOperationalSnapshots';
import { extractMerchizeExternalOrderNumberFromDjangoProcessResponse } from '@/lib/merchizeFulfillmentOps/merchizeMapper';
import { CODEX_CHRISTI_FULFILLMENT_IDENTIFIER } from '@/lib/merchizeFulfillmentOps/fulfillmentIdentifier';
import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';

type AdminNotificationActionResult = { ok: true; message: string } | { ok: false; error: string };

async function verifyMasterAdminPasswordStepUp({
  password,
  action,
  targetId,
}: {
  password: string;
  action: string;
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
      targetType: 'orderToken',
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
      targetType: 'orderToken',
      targetId,
      outcome: 'failure',
      metadata: { reason: 'invalid_step_up_password' },
    });
    throw new Error('Master admin password is incorrect.');
  }

  return admin;
}

async function writeMerchizeFulfillmentAdminAction(args: {
  orderToken: string;
  action: string;
  actor: string;
  reason?: string | null;
  status: string;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) return;

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const order = await prisma.merchizeFulfillmentOrder.findFirst({
    where: { orderToken: args.orderToken },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  });

  await prisma.merchizeFulfillmentAdminAction.create({
    data: {
      merchizeFulfillmentOrderId: order?.id,
      orderToken: args.orderToken,
      action: args.action,
      actor: args.actor,
      reason: args.reason,
      status: args.status,
      errorMessage: args.errorMessage,
      metadata: args.metadata ? JSON.parse(JSON.stringify(args.metadata)) : undefined,
    },
  });
}

export type AdminRecoveryScannerActionResult =
  | {
      ok: true;
      message: string;
      scan: PayPalRecoveryScannerRunResult;
    }
  | {
      ok: false;
      error: string;
      scan?: PayPalRecoveryScannerRunResult;
    };

export async function scanAdminPaidOrderRecoveryCandidatesAction(): Promise<AdminRecoveryScannerActionResult> {
  try {
    const admin = await requireAdminAction('shop.recovery.run');
    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.paid_order_recovery.scan_candidates',
      outcome: 'started',
    });

    const scan = await runPayPalRecoveryScanner({ dryRun: true });
    const candidateCount = scan.candidates.length;

    return {
      ok: true,
      message: candidateCount
        ? `Found ${candidateCount} recoverable row${candidateCount === 1 ? '' : 's'}.`
        : 'No recoverable rows found.',
      scan,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Recovery scan failed.',
    };
  }
}

export async function runSelectedAdminPaidOrderRecoveryAction({
  orderTokens,
}: {
  orderTokens: string[];
}): Promise<AdminRecoveryScannerActionResult> {
  try {
    const admin = await requireAdminAction('shop.recovery.run');
    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.paid_order_recovery.run_selected',
      targetType: 'orderTokenBatch',
      outcome: 'started',
      metadata: { count: orderTokens.length },
    });

    if (!orderTokens.length) {
      return {
        ok: false,
        error: 'Select at least one recovery row.',
      };
    }

    const scan = await runSelectedPayPalRecoveryScanner({ orderTokens });

    revalidatePath('/admin/shop/paid-order-recovery');
    for (const orderToken of orderTokens) {
      revalidatePath(`/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`);
    }

    const completedCount = scan.results.filter((result) => result.ok).length;

    if (!scan.ok) {
      return {
        ok: false,
        error:
          completedCount > 0
            ? `${completedCount} row${completedCount === 1 ? '' : 's'} completed; review remaining results.`
            : 'Selected recovery did not complete.',
        scan,
      };
    }

    return {
      ok: true,
      message: completedCount
        ? `Completed ${completedCount} recovery row${completedCount === 1 ? '' : 's'}.`
        : 'No selected rows required recovery.',
      scan,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Selected recovery failed.',
    };
  }
}

export async function resendAdminRecoveryNotificationAction({
  notificationId,
  orderToken,
}: {
  notificationId: string;
  orderToken: string;
}): Promise<AdminNotificationActionResult> {
  try {
    const admin = await requireAdminAction('shop.recovery.run');
    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.paid_order_recovery.notification_resend',
      targetType: 'adminNotification',
      targetId: notificationId,
      outcome: 'started',
      metadata: { orderToken },
    });

    const result = await resendAdminRecoveryNotification(notificationId);

    revalidatePath(`/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`);

    if (!result.ok) {
      return {
        ok: false,
        error: result.error ?? 'Notification resend failed.',
      };
    }

    return {
      ok: true,
      message: 'Notification resent successfully.',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Notification resend failed.',
    };
  }
}

export async function suppressAdminRecoveryNotificationAction({
  notificationId,
  orderToken,
}: {
  notificationId: string;
  orderToken: string;
}): Promise<AdminNotificationActionResult> {
  try {
    const admin = await requireAdminAction('shop.recovery.run');
    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.paid_order_recovery.notification_suppress',
      targetType: 'adminNotification',
      targetId: notificationId,
      outcome: 'started',
      metadata: { orderToken },
    });

    await suppressAdminRecoveryNotification(notificationId);

    revalidatePath(`/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`);

    return {
      ok: true,
      message: 'Notification suppressed.',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Notification suppress failed.',
    };
  }
}

export async function resendCustomerNotificationAction({
  notificationId,
  orderToken,
}: {
  notificationId: string;
  orderToken: string;
}): Promise<AdminNotificationActionResult> {
  try {
    const admin = await requireAdminAction('shop.recovery.run');
    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.paid_order_recovery.customer_notification_resend',
      targetType: 'customerNotification',
      targetId: notificationId,
      outcome: 'started',
      metadata: { orderToken },
    });

    const result = await resendCustomerNotification(notificationId);

    revalidatePath(`/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`);

    if (!result.ok) {
      await writeAdminAuditLog({
        actor: admin,
        action: 'shop.paid_order_recovery.customer_notification_resend',
        targetType: 'customerNotification',
        targetId: notificationId,
        outcome: 'failure',
        metadata: { orderToken, error: result.error ?? 'Customer notification resend failed.' },
      });

      return {
        ok: false,
        error: result.error ?? 'Customer notification resend failed.',
      };
    }

    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.paid_order_recovery.customer_notification_resend',
      targetType: 'customerNotification',
      targetId: notificationId,
      outcome: 'success',
      metadata: { orderToken },
    });

    return {
      ok: true,
      message: 'Customer notification resent successfully.',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Customer notification resend failed.',
    };
  }
}

export async function retryAdminPaidOrderRecoveryAction({
  orderToken,
}: {
  orderToken: string;
}): Promise<AdminNotificationActionResult> {
  try {
    const admin = await requireAdminAction('shop.recovery.run');
    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.paid_order_recovery.retry',
      targetType: 'orderToken',
      targetId: orderToken,
      outcome: 'started',
    });

    const existing = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
      select: {
        status: true,
        processingCompletedAt: true,
        postProcessingLockExpiresAt: true,
        merchizeFulfillmentResponsePayload: true,
      },
    });

    if (!existing) {
      return {
        ok: false,
        error: 'Recovery row was not found.',
      };
    }

    if (existing.processingCompletedAt) {
      return {
        ok: false,
        error: 'This order is already completed.',
      };
    }

    if (existing.postProcessingLockExpiresAt && existing.postProcessingLockExpiresAt > new Date()) {
      return {
        ok: false,
        error: 'This order is already being processed.',
      };
    }

    await runPaidFulfillmentProcessing(orderToken);

    revalidatePath(`/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`);
    revalidatePath('/admin/shop/paid-order-recovery');

    const updated = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
      select: {
        status: true,
        processingCompletedAt: true,
        lastErrorMessage: true,
      },
    });

    if (!updated) {
      return {
        ok: false,
        error: 'Recovery row could not be reloaded after retry.',
      };
    }

    if (updated.processingCompletedAt) {
      return {
        ok: true,
        message: 'Order completed after retry.',
      };
    }

    return {
      ok: false,
      error: updated.lastErrorMessage ?? `Retry ended in ${updated.status}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Retry failed.',
    };
  }
}

export async function overrideMerchizePushDisabledAndReleaseAction({
  orderToken,
  password,
  reason,
}: {
  orderToken: string;
  password: string;
  reason: string;
}): Promise<AdminNotificationActionResult> {
  const action = 'shop.paid_order_recovery.override_push_disabled_release';

  try {
    const releaseReason = reason.trim();

    if (!releaseReason) {
      return {
        ok: false,
        error: 'A release reason is required.',
      };
    }

    const admin = await verifyMasterAdminPasswordStepUp({
      password,
      action,
      targetId: orderToken,
    });

    await writeAdminAuditLog({
      actor: admin,
      action,
      targetType: 'orderToken',
      targetId: orderToken,
      outcome: 'started',
      metadata: { hasReason: true },
    });

    const rejectAfterStepUp = async (error: string) => {
      await writeMerchizeFulfillmentAdminAction({
        orderToken,
        action: 'manual_push_disabled_override',
        actor: admin.userID,
        reason: releaseReason,
        status: 'failed',
        errorMessage: error,
      });
      await writeAdminAuditLog({
        actor: admin,
        action,
        targetType: 'orderToken',
        targetId: orderToken,
        outcome: 'failure',
        metadata: { error },
      });

      return {
        ok: false as const,
        error,
      };
    };

    await writeMerchizeFulfillmentAdminAction({
      orderToken,
      action: 'manual_push_disabled_override',
      actor: admin.userID,
      reason: releaseReason,
      status: 'started',
    });

    const existing = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
      select: {
        status: true,
        lastErrorCode: true,
        processingCompletedAt: true,
        postProcessingLockExpiresAt: true,
      },
    });

    if (!existing) {
      return rejectAfterStepUp('Recovery row was not found.');
    }

    if (existing.processingCompletedAt) {
      return rejectAfterStepUp('This order is already completed.');
    }

    if (
      existing.status !== 'fulfillment_attention_required' ||
      existing.lastErrorCode !== 'MERCHIZE_PUSH_DISABLED_BY_CONFIG'
    ) {
      return rejectAfterStepUp('This order is not waiting on the push-disabled release gate.');
    }

    if (existing.postProcessingLockExpiresAt && existing.postProcessingLockExpiresAt > new Date()) {
      return rejectAfterStepUp('This order is already being processed.');
    }

    await runPaidFulfillmentProcessing(orderToken, {
      overrideMerchizeFulfillmentPushDisabled: true,
    });

    revalidatePath(`/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`);
    revalidatePath('/admin/shop/paid-order-recovery');

    const updated = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
      select: {
        status: true,
        processingCompletedAt: true,
        lastErrorMessage: true,
      },
    });

    if (updated?.processingCompletedAt) {
      await writeMerchizeFulfillmentAdminAction({
        orderToken,
        action: 'manual_push_disabled_override',
        actor: admin.userID,
        reason: releaseReason,
        status: 'succeeded',
      });
      await writeAdminAuditLog({
        actor: admin,
        action,
        targetType: 'orderToken',
        targetId: orderToken,
        outcome: 'success',
      });

      return {
        ok: true,
        message: 'Push override completed and the order moved to fulfillment.',
      };
    }

    const error = updated?.lastErrorMessage ?? `Release ended in ${updated?.status ?? 'unknown'}.`;
    await writeMerchizeFulfillmentAdminAction({
      orderToken,
      action: 'manual_push_disabled_override',
      actor: admin.userID,
      reason: releaseReason,
      status: 'failed',
      errorMessage: error,
    });
    await writeAdminAuditLog({
      actor: admin,
      action,
      targetType: 'orderToken',
      targetId: orderToken,
      outcome: 'failure',
      metadata: { error },
    });

    return {
      ok: false,
      error,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Push override failed.',
    };
  }
}

export async function syncAdminMerchizeProviderDetailsAction({
  orderToken,
}: {
  orderToken: string;
}): Promise<AdminNotificationActionResult> {
  try {
    const admin = await requireAdminAction('shop.recovery.run');
    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.paid_order_recovery.sync_merchize_provider_details',
      targetType: 'orderToken',
      targetId: orderToken,
      outcome: 'started',
    });

    const existing = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
      select: {
        orderToken: true,
        paypalOrderId: true,
        djangoOrderIntentUuid: true,
        djangoOrderIntentOrderId: true,
        djangoPaymentSaveCustomId: true,
        customerEmail: true,
        shippingSnapshot: true,
        fulfillmentAddressOverride: true,
        cartSnapshot: true,
        merchizeFulfillmentResponsePayload: true,
        merchizeProviderOrderCode: true,
      },
    });

    if (!existing) {
      return {
        ok: false,
        error: 'Recovery row was not found.',
      };
    }

    if (!isAcceptedDjangoFulfillmentProcessResponse(existing.merchizeFulfillmentResponsePayload)) {
      return {
        ok: false,
        error: 'This row does not have an accepted Django fulfillment process response.',
      };
    }

    if (!existing.djangoPaymentSaveCustomId) {
      return {
        ok: false,
        error: 'Django payment save custom ID is missing.',
      };
    }

    const merchizeExternalOrderNumber = extractMerchizeExternalOrderNumberFromDjangoProcessResponse(
      existing.merchizeFulfillmentResponsePayload,
      existing.djangoOrderIntentOrderId,
    );

    if (!merchizeExternalOrderNumber) {
      return {
        ok: false,
        error: 'Merchize external order number could not be extracted from the accepted response.',
      };
    }

    const registration = await registerAcceptedMerchizeFulfillmentProcess({
      orderToken: existing.orderToken,
      paypalOrderId: existing.paypalOrderId,
      djangoOrderIntentUuid: existing.djangoOrderIntentUuid,
      djangoOrderIntentOrderId: existing.djangoOrderIntentOrderId,
      djangoPaymentSaveCustomId: existing.djangoPaymentSaveCustomId,
      fulfillmentIdentifier: CODEX_CHRISTI_FULFILLMENT_IDENTIFIER,
      merchizeExternalOrderNumber,
      merchizeOrderId: null,
      merchizeOrderCode: existing.merchizeProviderOrderCode ?? merchizeExternalOrderNumber,
      merchizeStatus: null,
      djangoProcessResponsePayload: existing.merchizeFulfillmentResponsePayload,
      customerEmail: existing.customerEmail,
      shippingSnapshot: existing.fulfillmentAddressOverride ?? existing.shippingSnapshot,
      cartSnapshot: existing.cartSnapshot,
    });

    if (!registration.ok) {
      return {
        ok: false,
        error: 'Merchize Fulfillment Ops database is not configured.',
      };
    }

    const sync = await syncMerchizeFulfillmentOrder(existing.orderToken);
    const snapshots = sync.ok
      ? await syncMerchizeFulfillmentOperationalSnapshots(existing.orderToken)
      : null;

    revalidatePath(`/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`);
    revalidatePath('/admin/shop/paid-order-recovery');

    if (!sync.ok) {
      return {
        ok: false,
        error: sync.errorMessage,
      };
    }

    return {
      ok: true,
      message:
        snapshots && !snapshots.ok
          ? `Merchize provider details synced for ${sync.merchizeOrderId}; review snapshot attempts for progress, tracking, or invoice gaps.`
          : `Merchize provider details synced for ${sync.merchizeOrderId}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Merchize provider detail sync failed.',
    };
  }
}

export async function savePaidOrderFulfillmentAddressOverrideAction({
  orderToken,
  address,
  reason,
}: {
  orderToken: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  reason: string;
}): Promise<AdminNotificationActionResult> {
  try {
    const admin = await requireAdminAction('shop.recovery.run');
    await writeAdminAuditLog({
      actor: admin,
      action: 'shop.paid_order_recovery.address_override_save',
      targetType: 'orderToken',
      targetId: orderToken,
      outcome: 'started',
      metadata: { hasReason: Boolean(reason.trim()), country: address.country.trim() },
    });

    if (!reason.trim()) {
      return {
        ok: false,
        error: 'A reason is required before saving an address override.',
      };
    }

    if (
      !address.line1.trim() ||
      !address.city.trim() ||
      !address.state.trim() ||
      !address.postalCode.trim() ||
      !address.country.trim()
    ) {
      return {
        ok: false,
        error: 'Address line, city, state, postal code, and country are required.',
      };
    }

    await paypalTxLedger.paypalIntent.update({
      where: { orderToken },
      data: {
        fulfillmentAddressOverride: {
          shipping_address_line_1: address.line1.trim(),
          shipping_address_line_2: address.line2?.trim() ?? '',
          shipping_city: address.city.trim(),
          shipping_state: address.state.trim(),
          zip_code: address.postalCode.trim(),
          shipping_country: address.country.trim(),
        },
        fulfillmentAddressOverrideReason: reason.trim(),
        fulfillmentAddressOverriddenBy: 'admin',
        fulfillmentAddressOverriddenAt: new Date(),
      },
    });

    revalidatePath(`/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`);

    return {
      ok: true,
      message: 'Fulfillment address override saved.',
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Address override could not be saved.',
    };
  }
}
