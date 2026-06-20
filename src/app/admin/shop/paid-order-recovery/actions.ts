'use server';

import { revalidatePath } from 'next/cache';
import { writeAdminAuditLog } from '@/lib/admin/admin-auth-ledger';
import { requireAdminAction } from '@/lib/admin/require-admin';
import {
  resendAdminRecoveryNotification,
  suppressAdminRecoveryNotification,
} from '@/lib/paypal/txLedger/adminNotificationOutbox';
import {
  runPayPalRecoveryScanner,
  runSelectedPayPalRecoveryScanner,
  type PayPalRecoveryScannerRunResult,
} from '@/lib/paypal/txLedger/recoveryScanner';
import { runPostProcessing } from '@/lib/paypal/txLedger/runPostProcessing';
import { isAcceptedDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/adminPaidOrderRecovery';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { registerAcceptedMerchizeFulfillmentPush } from '@/lib/merchizeFulfillmentOps/registerAcceptedMerchizeFulfillmentPush';
import { syncMerchizeFulfillmentOrder } from '@/lib/merchizeFulfillmentOps/syncMerchizeFulfillmentOrder';
import { extractMerchizeExternalOrderNumberFromDjangoProcessResponse } from '@/lib/merchizeFulfillmentOps/merchizeMapper';

type AdminNotificationActionResult = { ok: true; message: string } | { ok: false; error: string };

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

    if (isAcceptedDjangoFulfillmentProcessResponse(existing.merchizeFulfillmentResponsePayload)) {
      return {
        ok: false,
        error:
          'Fulfillment was already accepted. Sync Merchize provider details instead of retrying full post-processing.',
      };
    }

    await runPostProcessing(orderToken);

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

    const registration = await registerAcceptedMerchizeFulfillmentPush({
      orderToken: existing.orderToken,
      paypalOrderId: existing.paypalOrderId,
      djangoOrderIntentUuid: existing.djangoOrderIntentUuid,
      djangoOrderIntentOrderId: existing.djangoOrderIntentOrderId,
      djangoPaymentSaveCustomId: existing.djangoPaymentSaveCustomId,
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
      message: `Merchize provider details synced for ${sync.merchizeOrderId}.`,
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
