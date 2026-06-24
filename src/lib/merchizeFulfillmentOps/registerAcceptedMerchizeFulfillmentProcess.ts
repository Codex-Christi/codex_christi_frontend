import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  buildRegistrationSummaries,
  toOptionalPrismaJson,
} from '@/lib/merchizeFulfillmentOps/merchizeMapper';
import { safeLogErrorMessage } from '@/lib/merchizeFulfillmentOps/redaction';
import {
  MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_STATUS,
} from '@/lib/merchizeFulfillmentOps/status';
import { syncMerchizeFulfillmentOrder } from './syncMerchizeFulfillmentOrder';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';
import type { MerchizeFulfillmentRegistrationInput } from './merchizeTypes';

type RegistrationResult =
  | {
      ok: true;
      skipped: false;
      orderToken: string;
      merchizeExternalOrderNumber: string;
      syncResult?: Awaited<ReturnType<typeof syncMerchizeFulfillmentOrder>>;
    }
  | {
      ok: false;
      skipped: true;
      orderToken: string;
      reason: string;
    };

export async function registerAcceptedMerchizeFulfillmentProcess(
  input: MerchizeFulfillmentRegistrationInput,
  options: { syncImmediately?: boolean } = {},
): Promise<RegistrationResult> {
  if (!input.merchizeExternalOrderNumber) {
    throw new Error(
      'Missing merchizeExternalOrderNumber for Merchize Fulfillment Ops registration.',
    );
  }

  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) {
    console.info('[merchize.fulfillment_ops.registration_skipped]', {
      orderToken: input.orderToken,
      merchizeExternalOrderNumber: input.merchizeExternalOrderNumber,
      reason: 'database_not_configured',
    });

    return {
      ok: false,
      skipped: true,
      orderToken: input.orderToken,
      reason: 'database_not_configured',
    };
  }

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const summary = buildRegistrationSummaries(input);
  const now = new Date();

  const order = await prisma.merchizeFulfillmentOrder.upsert({
    where: { merchizeExternalOrderNumber: input.merchizeExternalOrderNumber },
    create: {
      orderToken: input.orderToken,
      paypalOrderId: input.paypalOrderId,
      djangoOrderIntentUuid: input.djangoOrderIntentUuid,
      djangoOrderIntentOrderId: input.djangoOrderIntentOrderId,
      djangoPaymentSaveCustomId: input.djangoPaymentSaveCustomId,
      merchizeExternalOrderNumber: input.merchizeExternalOrderNumber,
      merchizeOrderId: input.merchizeOrderId,
      merchizeOrderCode: input.merchizeOrderCode,
      merchizeIdentifier: input.fulfillmentIdentifier,
      merchizeStatus: input.merchizeStatus,
      customerEmailRedacted: summary.customerEmailRedacted,
      shippingCity: summary.shippingCity,
      shippingState: summary.shippingState,
      shippingCountry: summary.shippingCountry,
      itemCount: summary.itemCount,
      totalQuantity: summary.totalQuantity,
      orderCurrency: summary.orderCurrency,
      djangoProcessResponsePayload: toOptionalPrismaJson(input.djangoProcessResponsePayload),
      syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.PROCESS_ACCEPTED,
    },
    update: {
      orderToken: input.orderToken,
      paypalOrderId: input.paypalOrderId,
      djangoOrderIntentUuid: input.djangoOrderIntentUuid,
      djangoOrderIntentOrderId: input.djangoOrderIntentOrderId,
      djangoPaymentSaveCustomId: input.djangoPaymentSaveCustomId,
      merchizeOrderId: input.merchizeOrderId ?? undefined,
      merchizeOrderCode: input.merchizeOrderCode,
      merchizeIdentifier: input.fulfillmentIdentifier ?? undefined,
      merchizeStatus: input.merchizeStatus,
      customerEmailRedacted: summary.customerEmailRedacted,
      shippingCity: summary.shippingCity,
      shippingState: summary.shippingState,
      shippingCountry: summary.shippingCountry,
      itemCount: summary.itemCount,
      totalQuantity: summary.totalQuantity,
      orderCurrency: summary.orderCurrency,
      djangoProcessResponsePayload: toOptionalPrismaJson(input.djangoProcessResponsePayload),
      lastSyncErrorCode: null,
      lastSyncErrorMessage: null,
    },
  });

  await prisma.merchizeFulfillmentSyncAttempt.create({
    data: {
      merchizeFulfillmentOrderId: order.id,
      orderToken: input.orderToken,
      action: 'registration',
      status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED,
      responseSummary: {
        merchizeExternalOrderNumber: input.merchizeExternalOrderNumber,
        registeredAt: now.toISOString(),
      },
      startedAt: now,
      finishedAt: now,
    },
  });

  let syncResult: Awaited<ReturnType<typeof syncMerchizeFulfillmentOrder>> | undefined;
  if (options.syncImmediately) {
    try {
      syncResult = await syncMerchizeFulfillmentOrder(input.orderToken);
    } catch (error) {
      console.error('[merchize.fulfillment_ops.initial_sync_failed]', {
        orderToken: input.orderToken,
        merchizeExternalOrderNumber: input.merchizeExternalOrderNumber,
        error: safeLogErrorMessage(error),
      });
    }
  }

  await refreshPaidOrderRecoveryProjectionSafely(input.orderToken);

  return {
    ok: true,
    skipped: false,
    orderToken: input.orderToken,
    merchizeExternalOrderNumber: input.merchizeExternalOrderNumber,
    syncResult,
  };
}
