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
  sendMerchizeFulfillmentOrder,
} from '@/lib/paypal/txLedger/sendMerchizeFulfillmentOrder';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { encryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';

const POST_PROCESSING_LEASE_MS = 5 * 60_000;

function buildPaymentReceiptPayload(args: PaymentReceiptProps) {
  return encryptForPostProcessingServerAction(JSON.stringify(args));
}

function buildPaymentSavePayload(args: PaymentSavingActionProps) {
  return encryptForPostProcessingServerAction(JSON.stringify(args));
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

export async function runPostProcessing(orderToken: string) {
  const now = new Date();
  const lockId = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + POST_PROCESSING_LEASE_MS);

  // The lease prevents overlapping webhook retries from running the same side effects twice.
  const lease = await paypalTxLedger.paypalIntent.updateMany({
    where: {
      orderToken,
      processingCompletedAt: null,
      OR: [
        { postProcessingLockExpiresAt: null },
        { postProcessingLockExpiresAt: { lt: now } },
      ],
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
    const finalCapturedOrder = row.capturePayload as PaymentSavingActionProps['finalCapturedOrder'] | null;

    if (!authData || !finalCapturedOrder) {
      throw new Error('Missing authorize/capture payload in ledger');
    }

    const customer = {
      name: row.customerName,
      email: row.customerEmail,
    };
    const ORD_string = row.otpOrderId ?? row.orderToken;

    if (!row.receiptLink || !row.receiptFile) {
      const receiptRes = await savePaymentReceiptToCloud(
        buildPaymentReceiptPayload({
          authData,
          customer,
          ORD_string,
        }),
      );

      if (
        !receiptRes.success ||
        !('pdfReceiptLink' in receiptRes) ||
        !('receiptFileName' in receiptRes)
      ) {
        throw new Error(
          'message' in receiptRes ? receiptRes.message : 'Receipt upload failed',
        );
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

    if (!row.backendCustomId) {
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

      await updateLockedRow(
        orderToken,
        lockId,
        {
          status: PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
          backendCustomId: paymentSave.data?.custom_id ?? null,
          paymentSaveResponsePayload: JSON.parse(JSON.stringify(paymentSave)),
          lastErrorCode: null,
          lastErrorMessage: null,
        } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data'],
      );

      row.backendCustomId = paymentSave.data?.custom_id ?? null;
    }

    const fulfillmentSend = await sendMerchizeFulfillmentOrder({
      orderVariants: row.cartSnapshot as {
        variantId: string;
        quantity: number;
      }[],
      deliveryAddress: row.shippingSnapshot as PaymentSavingActionProps['delivery_address'],
      customer,
      countryIso2: row.countryIso2 ?? 'US',
      orderCustomId: row.backendCustomId ?? row.paypalOrderId ?? row.orderToken,
    });

    await updateLockedRow(
      orderToken,
      lockId,
      {
        status: PAYPAL_LEDGER_STATUS.COMPLETED,
        fulfillmentSendResponsePayload: JSON.parse(JSON.stringify(fulfillmentSend)),
        processingCompletedAt: new Date(),
        postProcessingLockId: null,
        postProcessingLockedAt: null,
        postProcessingLockExpiresAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      } as Parameters<typeof paypalTxLedger.paypalIntent.updateMany>[0]['data'],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await updateLockedRow(orderToken, lockId, {
      lastErrorCode: 'POST_PROCESSING_FAILED',
      lastErrorMessage: message,
      postProcessingLockId: null,
      postProcessingLockedAt: null,
      postProcessingLockExpiresAt: null,
    });

    throw error;
  }
}
