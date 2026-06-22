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
import { registerAcceptedMerchizeFulfillmentProcess } from '@/lib/merchizeFulfillmentOps/registerAcceptedMerchizeFulfillmentProcess';
import {
  recordMerchizeFulfillmentPushDisabledByConfig,
  MerchizeFulfillmentPushError,
  pushMerchizeFulfillmentOrderToProduction,
} from '@/lib/merchizeFulfillmentOps/pushMerchizeFulfillmentOrderToProduction';
import { isMerchizeFulfillmentPushEnabled } from '@/lib/merchizeFulfillmentOps/pushPolicy';
import { CODEX_CHRISTI_FULFILLMENT_IDENTIFIER } from '@/lib/merchizeFulfillmentOps/fulfillmentIdentifier';
import { syncMerchizeFulfillmentOrder } from '@/lib/merchizeFulfillmentOps/syncMerchizeFulfillmentOrder';
import { syncMerchizeFulfillmentOperationalSnapshots } from '@/lib/merchizeFulfillmentOps/syncMerchizeFulfillmentOperationalSnapshots';
import { extractMerchizeExternalOrderNumberFromDjangoProcessResponse } from '@/lib/merchizeFulfillmentOps/merchizeMapper';
import {
  enqueueAdminFulfillmentPushAcceptedNotification,
  enqueueAdminRecoveryNotification,
  ADMIN_NOTIFICATION_SEVERITY,
  sendPendingAdminRecoveryNotificationsForOrder,
} from '@/lib/paypal/txLedger/adminNotificationOutbox';
import {
  enqueueCustomerFulfillmentPushAcceptedNotification,
  sendPendingCustomerNotificationsForOrder,
} from '@/lib/paypal/txLedger/customerNotificationOutbox';
import { isAcceptedDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/fulfillmentProcessResponse';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { encryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';
import type { CartVariant } from '@/stores/shop_stores/cartStore';

const POST_PROCESSING_LEASE_MS = 5 * 60_000;

type RunPaidFulfillmentProcessingOptions = {
  overrideMerchizeFulfillmentPushDisabled?: boolean;
  triggerDetail?: string;
  triggerSource?:
    | 'capture_route'
    | 'manual_admin'
    | 'payment_reconciliation'
    | 'recovery_scanner'
    | 'webhook';
};

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

async function markFulfillmentFailedAndNotify(args: {
  orderToken: string;
  lockId: string;
  row: {
    paypalOrderId: string | null;
    customerName: string;
    customerEmail: string;
    receiptLink: string | null;
  };
  errorCode: string;
  errorMessage: string;
  issueSummary?: string[];
  requestPayload?: unknown;
  responsePayload?: unknown;
  merchizeFulfillmentProcessingId?: string | null;
  merchizeProviderOrderId?: string | null;
  merchizeProviderOrderCode?: string | null;
}) {
  await paypalTxLedger.$transaction(async (tx) => {
    await tx.paypalIntent.updateMany({
      where: { orderToken: args.orderToken, postProcessingLockId: args.lockId },
      data: {
        status: PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
        lastErrorCode: args.errorCode,
        lastErrorMessage: args.errorMessage,
        merchizeFulfillmentRequestPayload:
          args.requestPayload === undefined ? undefined : toLedgerJson(args.requestPayload),
        merchizeFulfillmentResponsePayload:
          args.responsePayload === undefined ? undefined : toLedgerJson(args.responsePayload),
        merchizeFulfillmentProcessingId: args.merchizeFulfillmentProcessingId ?? undefined,
        merchizeProviderOrderId: args.merchizeProviderOrderId ?? undefined,
        merchizeProviderOrderCode: args.merchizeProviderOrderCode ?? undefined,
        postProcessingLockId: null,
        postProcessingLockedAt: null,
        postProcessingLockExpiresAt: null,
      } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data'],
    });

    await enqueueAdminRecoveryNotification({
      db: tx,
      orderToken: args.orderToken,
      paypalOrderId: args.row.paypalOrderId,
      customerName: args.row.customerName,
      customerEmail: args.row.customerEmail,
      ledgerStatus: PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      issueSummary: args.issueSummary ?? [args.errorMessage],
      receiptLink: args.row.receiptLink,
    });
  });

  await sendPendingAdminRecoveryNotificationsForOrder(args.orderToken).catch(
    (notificationError) => {
      console.error('[AdminNotificationOutbox] failed to send fulfillment failed alert', {
        orderToken: args.orderToken,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    },
  );
}

async function markFulfillmentAttentionRequiredAndNotify(args: {
  orderToken: string;
  lockId: string;
  row: {
    paypalOrderId: string | null;
    customerName: string;
    customerEmail: string;
    receiptLink: string | null;
  };
  errorCode: string;
  errorMessage: string;
  issueSummary?: string[];
  requestPayload?: unknown;
  responsePayload?: unknown;
  merchizeFulfillmentProcessingId?: string | null;
  merchizeProviderOrderId?: string | null;
  merchizeProviderOrderCode?: string | null;
}) {
  await paypalTxLedger.$transaction(async (tx) => {
    await tx.paypalIntent.updateMany({
      where: { orderToken: args.orderToken, postProcessingLockId: args.lockId },
      data: {
        status: PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED,
        lastErrorCode: args.errorCode,
        lastErrorMessage: args.errorMessage,
        merchizeFulfillmentRequestPayload:
          args.requestPayload === undefined ? undefined : toLedgerJson(args.requestPayload),
        merchizeFulfillmentResponsePayload:
          args.responsePayload === undefined ? undefined : toLedgerJson(args.responsePayload),
        merchizeFulfillmentProcessingId: args.merchizeFulfillmentProcessingId ?? undefined,
        merchizeProviderOrderId: args.merchizeProviderOrderId ?? undefined,
        merchizeProviderOrderCode: args.merchizeProviderOrderCode ?? undefined,
        postProcessingLockId: null,
        postProcessingLockedAt: null,
        postProcessingLockExpiresAt: null,
      } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data'],
    });

    await enqueueAdminRecoveryNotification({
      db: tx,
      orderToken: args.orderToken,
      paypalOrderId: args.row.paypalOrderId,
      customerName: args.row.customerName,
      customerEmail: args.row.customerEmail,
      ledgerStatus: PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      issueSummary: args.issueSummary ?? [args.errorMessage],
      receiptLink: args.row.receiptLink,
      severity: ADMIN_NOTIFICATION_SEVERITY.WARNING,
    });
  });

  await sendPendingAdminRecoveryNotificationsForOrder(args.orderToken).catch(
    (notificationError) => {
      console.error('[AdminNotificationOutbox] failed to send fulfillment attention alert', {
        orderToken: args.orderToken,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    },
  );
}

async function notifyFulfillmentPushAccepted(args: {
  orderToken: string;
  row: {
    paypalOrderId: string | null;
    customerName: string;
    customerEmail: string;
    receiptLink: string | null;
  };
  merchizeExternalOrderNumber?: string | null;
  merchizeOrderId?: string | null;
  merchizeOrderCode?: string | null;
}) {
  await enqueueCustomerFulfillmentPushAcceptedNotification({
    orderToken: args.orderToken,
    paypalOrderId: args.row.paypalOrderId,
    customerName: args.row.customerName,
    customerEmail: args.row.customerEmail,
    receiptLink: args.row.receiptLink,
  }).catch((notificationError) => {
    console.error('[CustomerNotificationOutbox] failed to enqueue fulfillment success alert', {
      orderToken: args.orderToken,
      error:
        notificationError instanceof Error ? notificationError.message : String(notificationError),
    });
  });

  await enqueueAdminFulfillmentPushAcceptedNotification({
    orderToken: args.orderToken,
    paypalOrderId: args.row.paypalOrderId,
    customerName: args.row.customerName,
    customerEmail: args.row.customerEmail,
    receiptLink: args.row.receiptLink,
    merchizeExternalOrderNumber: args.merchizeExternalOrderNumber,
    merchizeOrderId: args.merchizeOrderId,
    merchizeOrderCode: args.merchizeOrderCode,
  }).catch((notificationError) => {
    console.error('[AdminNotificationOutbox] failed to enqueue fulfillment success alert', {
      orderToken: args.orderToken,
      error:
        notificationError instanceof Error ? notificationError.message : String(notificationError),
    });
  });

  await Promise.all([
    sendPendingCustomerNotificationsForOrder(args.orderToken).catch((notificationError) => {
      console.error('[CustomerNotificationOutbox] failed to send fulfillment success alert', {
        orderToken: args.orderToken,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    }),
    sendPendingAdminRecoveryNotificationsForOrder(args.orderToken).catch((notificationError) => {
      console.error('[AdminNotificationOutbox] failed to send fulfillment success alert', {
        orderToken: args.orderToken,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : String(notificationError),
      });
    }),
  ]);
}

export async function runPaidFulfillmentProcessing(
  orderToken: string,
  options: RunPaidFulfillmentProcessingOptions = {},
) {
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
      processingTriggerDetail: options.triggerDetail ?? null,
      processingTriggerSource: options.triggerSource ?? null,
      processingTriggeredAt: now,
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

    const captureCompletion = getPayPalCaptureCompletion(finalCapturedOrder);
    if (!captureCompletion.ok) {
      await updateLockedRow(orderToken, lockId, {
        status:
          captureCompletion.status === 'PENDING'
            ? PAYPAL_LEDGER_STATUS.PENDING
            : PAYPAL_LEDGER_STATUS.ERROR,
        lastErrorCode: 'CAPTURE_NOT_COMPLETED',
        lastErrorMessage: captureCompletion.reason,
        postProcessingLockId: null,
        postProcessingLockedAt: null,
        postProcessingLockExpiresAt: null,
      });
      throw new Error(captureCompletion.reason);
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
    let fulfillmentRequestPayload: unknown = row.merchizeFulfillmentRequestPayload;
    let fulfillmentResponsePayload: unknown = row.merchizeFulfillmentResponsePayload;
    let merchizeFulfillmentProcessingId = row.merchizeFulfillmentProcessingId;
    let merchizeProviderOrderId = row.merchizeProviderOrderId;
    let merchizeProviderOrderCode = row.merchizeProviderOrderCode;
    let merchizeProviderStatus: string | null = null;
    let merchizeExternalOrderNumber = isAcceptedDjangoFulfillmentProcessResponse(
      row.merchizeFulfillmentResponsePayload,
    )
      ? extractMerchizeExternalOrderNumberFromDjangoProcessResponse(
          row.merchizeFulfillmentResponsePayload,
          row.djangoOrderIntentOrderId,
        )
      : null;

    if (!merchizeExternalOrderNumber) {
      const fulfillmentSend = await sendMerchizeFulfillmentOrder({
        cartSnapshot: row.cartSnapshot as CartVariant[],
        djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
        identifier: CODEX_CHRISTI_FULFILLMENT_IDENTIFIER,
        currency: row.initialCurrency ?? 'USD',
        customerName: row.customerName,
        countryIso2: row.countryIso2,
        fulfillmentAddress,
      });

      fulfillmentRequestPayload = fulfillmentSend.requestPayload;
      fulfillmentResponsePayload = {
        ok: fulfillmentSend.ok,
        status: fulfillmentSend.status,
        success: fulfillmentSend.success,
        message: fulfillmentSend.message,
        data: fulfillmentSend.data,
      };
      merchizeFulfillmentProcessingId = fulfillmentSend.data?.id ?? null;
      merchizeProviderOrderId = fulfillmentSend.merchizeOrderIdentifiers.merchizeProviderOrderId;
      merchizeProviderOrderCode =
        fulfillmentSend.merchizeOrderIdentifiers.merchizeProviderOrderCode;
      merchizeProviderStatus = fulfillmentSend.merchizeOrderIdentifiers.merchizeProviderStatus;
      merchizeExternalOrderNumber =
        fulfillmentSend.merchizeOrderIdentifiers.merchizeExternalOrderNumber;

      await updateLockedRow(orderToken, lockId, {
        merchizeFulfillmentRequestPayload: toLedgerJson(fulfillmentRequestPayload),
        merchizeFulfillmentResponsePayload: toLedgerJson(fulfillmentResponsePayload),
        merchizeFulfillmentProcessingId,
        merchizeProviderOrderId,
        merchizeProviderOrderCode,
        lastErrorCode: null,
        lastErrorMessage: null,
      } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data']);
    }

    if (merchizeExternalOrderNumber) {
      await registerAcceptedMerchizeFulfillmentProcess({
        orderToken,
        paypalOrderId: row.paypalOrderId,
        djangoOrderIntentUuid: row.djangoOrderIntentUuid,
        djangoOrderIntentOrderId: row.djangoOrderIntentOrderId,
        djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
        fulfillmentIdentifier: CODEX_CHRISTI_FULFILLMENT_IDENTIFIER,
        merchizeExternalOrderNumber,
        merchizeOrderId: null,
        merchizeOrderCode: merchizeProviderOrderCode ?? merchizeExternalOrderNumber,
        merchizeStatus: merchizeProviderStatus,
        djangoProcessResponsePayload: fulfillmentResponsePayload,
        customerEmail: row.customerEmail,
        shippingSnapshot: fulfillmentAddress,
        cartSnapshot: row.cartSnapshot,
      });

      const sync = await syncMerchizeFulfillmentOrder(orderToken);
      if (!sync.ok) {
        await markFulfillmentFailedAndNotify({
          orderToken,
          lockId,
          row,
          errorCode: sync.errorCode,
          errorMessage: sync.errorMessage,
          requestPayload: fulfillmentRequestPayload,
          responsePayload: fulfillmentResponsePayload,
          merchizeFulfillmentProcessingId,
          merchizeProviderOrderId,
          merchizeProviderOrderCode,
        });
        return;
      }

      if (!options.overrideMerchizeFulfillmentPushDisabled && !isMerchizeFulfillmentPushEnabled()) {
        const message =
          'Merchize push-to-fulfillment is disabled by MERCHIZE_FULFILLMENT_PUSH_ENABLED=false.';
        await recordMerchizeFulfillmentPushDisabledByConfig({
          orderToken,
          merchizeExternalOrderNumber,
          merchizeOrderCode: merchizeProviderOrderCode,
          identifier: CODEX_CHRISTI_FULFILLMENT_IDENTIFIER,
        });
        await markFulfillmentAttentionRequiredAndNotify({
          orderToken,
          lockId,
          row,
          errorCode: 'MERCHIZE_PUSH_DISABLED_BY_CONFIG',
          errorMessage: message,
          issueSummary: [
            'Payment-side work completed and the provider order was registered.',
            'Merchize push-to-fulfillment was skipped because production push is disabled by configuration.',
            'Use master-admin manual release when this order is safe to push.',
          ],
          requestPayload: fulfillmentRequestPayload,
          responsePayload: fulfillmentResponsePayload,
          merchizeFulfillmentProcessingId,
          merchizeProviderOrderId,
          merchizeProviderOrderCode,
        });
        return;
      }

      try {
        await pushMerchizeFulfillmentOrderToProduction({
          orderToken,
          merchizeExternalOrderNumber,
          merchizeOrderCode: merchizeProviderOrderCode,
          identifier: CODEX_CHRISTI_FULFILLMENT_IDENTIFIER,
        });
      } catch (pushError) {
        const message =
          pushError instanceof Error ? pushError.message : 'Merchize push-to-fulfillment failed.';
        await markFulfillmentFailedAndNotify({
          orderToken,
          lockId,
          row,
          errorCode:
            pushError instanceof MerchizeFulfillmentPushError
              ? pushError.code
              : 'MERCHIZE_PUSH_FAILED',
          errorMessage: message,
          requestPayload: fulfillmentRequestPayload,
          responsePayload: fulfillmentResponsePayload,
          merchizeFulfillmentProcessingId,
          merchizeProviderOrderId,
          merchizeProviderOrderCode,
        });
        return;
      }

      await updateLockedRow(orderToken, lockId, {
        status: PAYPAL_LEDGER_STATUS.COMPLETED,
        merchizeFulfillmentRequestPayload: toLedgerJson(fulfillmentRequestPayload),
        merchizeFulfillmentResponsePayload: toLedgerJson(fulfillmentResponsePayload),
        merchizeFulfillmentProcessingId,
        merchizeProviderOrderId,
        merchizeProviderOrderCode,
        processingCompletedAt: new Date(),
        postProcessingLockId: null,
        postProcessingLockedAt: null,
        postProcessingLockExpiresAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data']);

      await syncMerchizeFulfillmentOperationalSnapshots(orderToken).catch((snapshotError) => {
        console.error('[merchize.fulfillment_ops.operational_snapshot_failed]', {
          orderToken,
          merchizeExternalOrderNumber,
          error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        });
      });

      await notifyFulfillmentPushAccepted({
        orderToken,
        row,
        merchizeExternalOrderNumber,
        merchizeOrderId: sync.merchizeOrderId,
        merchizeOrderCode: merchizeProviderOrderCode,
      });
    } else {
      await markFulfillmentFailedAndNotify({
        orderToken,
        lockId,
        row,
        errorCode: 'MERCHIZE_EXTERNAL_ORDER_NUMBER_MISSING',
        errorMessage: 'Merchize external order number was missing after Django process acceptance.',
        requestPayload: fulfillmentRequestPayload,
        responsePayload: fulfillmentResponsePayload,
        merchizeFulfillmentProcessingId,
        merchizeProviderOrderId,
        merchizeProviderOrderCode,
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
