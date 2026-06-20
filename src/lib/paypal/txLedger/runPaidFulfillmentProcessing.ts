import 'server-only';

import { randomUUID } from 'crypto';

import {
  savePaymentDataToBackend,
  type PaymentSavingActionProps,
} from '@/actions/shop/paypal/processAndUploadCompletedTx/savePaymentDataToBackend';
import {
  savePaymentReceiptToCloud,
  type PaymentReceiptProps,
} from '@/actions/shop/paypal/processAndUploadCompletedTx/savePaymentReceiptToCloud';
import {
  FulfillmentPayloadValidationError,
  FulfillmentProviderRejectedError,
  sendMerchizeFulfillmentOrder,
} from '@/lib/paypal/txLedger/sendMerchizeFulfillmentOrder';
import { registerAcceptedMerchizeFulfillmentPush } from '@/lib/merchizeFulfillmentOps/registerAcceptedMerchizeFulfillmentPush';
import { safeLogErrorMessage } from '@/lib/merchizeFulfillmentOps/redaction';
import {
  enqueueAdminRecoveryNotification,
  sendPendingAdminRecoveryNotificationsForOrder,
} from '@/lib/paypal/txLedger/adminNotificationOutbox';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { encryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';
import type { CartVariant } from '@/stores/shop_stores/cartStore';

const POST_PROCESSING_LEASE_MS = 5 * 60_000;

function buildPaymentReceiptPayload(args: PaymentReceiptProps) {
  return encryptForPostProcessingServerAction(JSON.stringify(args));
}

function buildPaymentSavePayload(args: PaymentSavingActionProps) {
  return encryptForPostProcessingServerAction(JSON.stringify(args));
}

function toLedgerJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

async function clearLock(orderToken: string, lockId: string) {
  await paypalTxLedger.paypalIntent.updateMany({
    where: { orderToken, postProcessingLockId: lockId },
    data: {
      postProcessingLockId: null,
      postProcessingLockedAt: null,
      postProcessingLockExpiresAt: null,
    },
  });
}

async function updateLockedRow(
  orderToken: string,
  lockId: string,
  data: Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data'],
) {
  await paypalTxLedger.paypalIntent.updateMany({
    where: { orderToken, postProcessingLockId: lockId },
    data,
  });
}

export async function runPaidFulfillmentProcessing(orderToken: string) {
  const now = new Date();
  const lockId = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + POST_PROCESSING_LEASE_MS);

  // The lease prevents overlapping webhook retries from running the same side effects twice.
  const lease = await paypalTxLedger.paypalIntent.updateMany({
    where: {
      orderToken,
      processingCompletedAt: null,
      OR: [{ postProcessingLockExpiresAt: null }, { postProcessingLockExpiresAt: { lt: now } }],
    },
    data: {
      postProcessingLockId: lockId,
      postProcessingLockedAt: now,
      postProcessingLockExpiresAt: leaseExpiresAt,
    },
  });

  if (lease.count === 0) return;

  const row = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
  if (!row) {
    throw new Error('Ledger row not found');
  }

  if (row.postProcessingLockId !== lockId) return;

  if (row.processingCompletedAt || row.status === PAYPAL_LEDGER_STATUS.COMPLETED) {
    await clearLock(orderToken, lockId);
    return;
  }

  try {
    const authData = row.authorizePayload as PaymentReceiptProps['authData'] | null;
    const finalCapturedOrder = row.capturePayload as
      | PaymentSavingActionProps['finalCapturedOrder']
      | null;

    if (!authData || !finalCapturedOrder) {
      throw new Error('Missing authorize/capture payload in ledger');
    }

    const customer = {
      name: row.customerName,
      email: row.customerEmail,
    };
    const ORD_string = row.djangoOrderIntentOrderId ?? row.orderToken;

    if (!row.receiptLink || !row.receiptFile) {
      const receiptRes = await savePaymentReceiptToCloud(
        buildPaymentReceiptPayload({
          authData,
          cart: row.cartSnapshot as CartVariant[],
          customer,
          ORD_string,
        }),
      );

      if (
        !receiptRes.success ||
        !('pdfReceiptLink' in receiptRes) ||
        !('receiptFileName' in receiptRes)
      ) {
        throw new Error('message' in receiptRes ? receiptRes.message : 'Receipt upload failed');
      }

      await updateLockedRow(orderToken, lockId, {
        status: PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
        receiptLink: receiptRes.pdfReceiptLink,
        receiptFile: receiptRes.receiptFileName,
        lastErrorCode: null,
        lastErrorMessage: null,
      });

      row.receiptLink = receiptRes.pdfReceiptLink;
      row.receiptFile = receiptRes.receiptFileName;
    }

    if (!row.djangoPaymentSaveCustomId) {
      const paymentSave = await savePaymentDataToBackend(
        buildPaymentSavePayload({
          authData,
          capturedOrder: finalCapturedOrder,
          finalCapturedOrder,
          capturedOrderPaypalID: finalCapturedOrder.id ?? row.paypalOrderId ?? row.orderToken,
          customer,
          delivery_address: row.shippingSnapshot as PaymentSavingActionProps['delivery_address'],
          userId: row.userId,
          ORD_string,
          country_iso2: row.countryIso2 ?? 'US',
          pdfReceiptLink: row.receiptLink ?? '',
          receiptFileName: row.receiptFile ?? '',
        }),
      );

      if (!paymentSave.ok) {
        throw new Error(paymentSave.error?.message ?? 'Payment save failed');
      }

      const djangoPaymentSaveCustomId = paymentSave.data?.custom_id ?? null;

      await updateLockedRow(orderToken, lockId, {
        status: PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
        djangoPaymentSaveCustomId,
        djangoPaymentSaveResponsePayload: JSON.parse(JSON.stringify(paymentSave)),
        lastErrorCode: null,
        lastErrorMessage: null,
      } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data']);

      row.djangoPaymentSaveCustomId = djangoPaymentSaveCustomId;
    }

    if (!row.djangoPaymentSaveCustomId) {
      throw new Error('Missing Django payment save custom_id before fulfillment push');
    }

    const fulfillmentAddress =
      (row.fulfillmentAddressOverride as PaymentSavingActionProps['delivery_address'] | null) ??
      (row.shippingSnapshot as PaymentSavingActionProps['delivery_address']);
    const fulfillmentSend = await sendMerchizeFulfillmentOrder({
      cartSnapshot: row.cartSnapshot as CartVariant[],
      djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
      identifier: 'codexchristi-shop',
      currency: row.initialCurrency ?? 'USD',
      customerName: row.customerName,
      countryIso2: row.countryIso2,
      fulfillmentAddress,
    });
    const fulfillmentResponsePayload = {
      ok: fulfillmentSend.ok,
      status: fulfillmentSend.status,
      success: fulfillmentSend.success,
      message: fulfillmentSend.message,
      data: fulfillmentSend.data,
    };

    await updateLockedRow(orderToken, lockId, {
      status: PAYPAL_LEDGER_STATUS.COMPLETED,
      merchizeFulfillmentRequestPayload: JSON.parse(JSON.stringify(fulfillmentSend.requestPayload)),
      merchizeFulfillmentResponsePayload: JSON.parse(JSON.stringify(fulfillmentResponsePayload)),
      merchizeFulfillmentProcessingId: fulfillmentSend.data?.id ?? null,
      merchizeProviderOrderId: fulfillmentSend.merchizeOrderIdentifiers.merchizeProviderOrderId,
      merchizeProviderOrderCode: fulfillmentSend.merchizeOrderIdentifiers.merchizeProviderOrderCode,
      processingCompletedAt: new Date(),
      postProcessingLockId: null,
      postProcessingLockedAt: null,
      postProcessingLockExpiresAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data']);

    const merchizeExternalOrderNumber =
      fulfillmentSend.merchizeOrderIdentifiers.merchizeExternalOrderNumber;
    if (merchizeExternalOrderNumber) {
      await registerAcceptedMerchizeFulfillmentPush(
        {
          orderToken,
          paypalOrderId: row.paypalOrderId,
          djangoOrderIntentUuid: row.djangoOrderIntentUuid,
          djangoOrderIntentOrderId: row.djangoOrderIntentOrderId,
          djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
          merchizeExternalOrderNumber,
          merchizeOrderId: null,
          merchizeOrderCode: fulfillmentSend.merchizeOrderIdentifiers.merchizeProviderOrderCode,
          merchizeStatus: fulfillmentSend.merchizeOrderIdentifiers.merchizeProviderStatus,
          djangoProcessResponsePayload: fulfillmentResponsePayload,
          customerEmail: row.customerEmail,
          shippingSnapshot: fulfillmentAddress,
          cartSnapshot: row.cartSnapshot,
        },
        { syncImmediately: true },
      ).catch((opsError) => {
        console.error('[merchize.fulfillment_ops.registration_failed]', {
          orderToken,
          merchizeExternalOrderNumber,
          error: safeLogErrorMessage(opsError),
        });
      });
    } else {
      console.error('[merchize.fulfillment_ops.registration_skipped]', {
        orderToken,
        reason: 'missing_merchize_external_order_number',
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof FulfillmentPayloadValidationError) {
      await paypalTxLedger.$transaction(async (tx) => {
        await tx.paypalIntent.updateMany({
          where: { orderToken, postProcessingLockId: lockId },
          data: {
            status: PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED,
            lastErrorCode: 'FULFILLMENT_PAYLOAD_INVALID',
            lastErrorMessage: message,
            merchizeFulfillmentRequestPayload: toLedgerJson(error.requestPayload),
            merchizeFulfillmentResponsePayload: toLedgerJson({
              source: 'local_validation',
              success: false,
              issues: error.issues,
            }),
            postProcessingLockId: null,
            postProcessingLockedAt: null,
            postProcessingLockExpiresAt: null,
          } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data'],
        });

        await enqueueAdminRecoveryNotification({
          db: tx,
          orderToken,
          paypalOrderId: row.paypalOrderId,
          customerName: row.customerName,
          customerEmail: row.customerEmail,
          ledgerStatus: PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED,
          errorCode: 'FULFILLMENT_PAYLOAD_INVALID',
          errorMessage: message,
          issueSummary: error.issues.map((issue) => issue.message),
          receiptLink: row.receiptLink,
        });
      });

      await sendPendingAdminRecoveryNotificationsForOrder(orderToken).catch((notificationError) => {
        console.error('[AdminNotificationOutbox] failed to send fulfillment blocked alert', {
          orderToken,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      });

      return;
    }

    if (error instanceof FulfillmentProviderRejectedError) {
      await paypalTxLedger.$transaction(async (tx) => {
        await tx.paypalIntent.updateMany({
          where: { orderToken, postProcessingLockId: lockId },
          data: {
            status: PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
            lastErrorCode: 'FULFILLMENT_PROVIDER_REJECTED',
            lastErrorMessage: message,
            merchizeFulfillmentRequestPayload: toLedgerJson(error.requestPayload),
            merchizeFulfillmentResponsePayload: toLedgerJson(error.responsePayload),
            merchizeFulfillmentProcessingId: error.responsePayload.data?.id ?? null,
            merchizeProviderOrderId: error.responsePayload.data?.provider_order_id ?? null,
            merchizeProviderOrderCode: error.responsePayload.data?.provider_order_code ?? null,
            postProcessingLockId: null,
            postProcessingLockedAt: null,
            postProcessingLockExpiresAt: null,
          } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data'],
        });

        await enqueueAdminRecoveryNotification({
          db: tx,
          orderToken,
          paypalOrderId: row.paypalOrderId,
          customerName: row.customerName,
          customerEmail: row.customerEmail,
          ledgerStatus: PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
          errorCode: 'FULFILLMENT_PROVIDER_REJECTED',
          errorMessage: message,
          issueSummary: [message],
          receiptLink: row.receiptLink,
        });
      });

      await sendPendingAdminRecoveryNotificationsForOrder(orderToken).catch((notificationError) => {
        console.error('[AdminNotificationOutbox] failed to send fulfillment failed alert', {
          orderToken,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      });

      return;
    }

    await updateLockedRow(orderToken, lockId, {
      status: PAYPAL_LEDGER_STATUS.ERROR,
      lastErrorCode: 'POST_PROCESSING_FAILED',
      lastErrorMessage: message,
      postProcessingLockId: null,
      postProcessingLockedAt: null,
      postProcessingLockExpiresAt: null,
    });

    throw error;
  }
}
