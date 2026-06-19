'use server';

import { revalidatePath } from 'next/cache';
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
    await requireAdminAction('shop');

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
    await requireAdminAction('shop');

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
    await requireAdminAction('shop');

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
    await requireAdminAction('shop');

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
    await requireAdminAction('shop');

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
    await requireAdminAction('shop');

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
