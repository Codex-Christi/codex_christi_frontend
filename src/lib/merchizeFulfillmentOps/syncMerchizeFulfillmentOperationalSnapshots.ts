import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  getMerchizeExternalOrderInvoice,
  getMerchizeExternalOrderProgress,
  getMerchizeExternalOrderTracking,
  getMerchizeOrderHistory,
  getMerchizeOrderProgress,
  getMerchizeSendToFulfillmentDate,
  getMerchizeTransactionFee,
  listMerchizeExternalOrdersTickets,
  MerchizeApiError,
  type MerchizeExternalOrderReference,
} from './merchizeClient';
import {
  asRecord,
  summarizeProviderRequest,
  summarizeProviderResponse,
  toOptionalPrismaJson,
} from './merchizeMapper';
import { safeLogErrorMessage } from './redaction';
import { MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS } from './status';
import { readSupplierInvoice } from './supplierInvoice';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';
import {
  externalOrderLifecycleReference,
  externalOrderLifecycleWriter,
} from './saveExternalOrderLifecycle';

type SnapshotAction =
  | 'external_order_progress'
  | 'external_order_tracking'
  | 'external_order_invoice'
  | 'external_order_tickets'
  | 'provider_order_history'
  | 'provider_internal_progress'
  | 'provider_send_to_fulfillment'
  | 'provider_transaction_fee';

type SnapshotResult = {
  ok: boolean;
  orderToken: string;
  attempted: SnapshotAction[];
  failed: Array<{ action: SnapshotAction; errorCode: string; errorMessage: string }>;
};

type SnapshotOptions = {
  includeInvoice?: boolean;
};

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getSnapshotError(error: unknown) {
  if (error instanceof MerchizeApiError) {
    return {
      code: error.code,
      message: error.message,
      responseSummary: error.responseSummary,
    };
  }

  return {
    code: 'MERCHIZE_OPERATIONAL_SNAPSHOT_FAILED',
    message: safeLogErrorMessage(error),
    responseSummary: null,
  };
}

function buildReference(order: {
  merchizeExternalOrderNumber: string;
  merchizeOrderCode: string | null;
  merchizeIdentifier: string | null;
}): MerchizeExternalOrderReference {
  if (order.merchizeExternalOrderNumber) {
    return {
      externalNumber: order.merchizeExternalOrderNumber,
      identifier: order.merchizeIdentifier,
    };
  }

  return {
    code: order.merchizeOrderCode ?? '',
    identifier: order.merchizeIdentifier,
  };
}

export async function syncMerchizeFulfillmentOperationalSnapshots(
  orderToken: string,
  options: SnapshotOptions = {},
): Promise<SnapshotResult> {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) {
    return {
      ok: false,
      orderToken,
      attempted: [],
      failed: [
        {
          action: 'external_order_progress',
          errorCode: 'MERCHIZE_FULFILLMENT_OPS_DB_NOT_CONFIGURED',
          errorMessage: 'Merchize Fulfillment Ops database is not configured.',
        },
      ],
    };
  }

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const order = await prisma.merchizeFulfillmentOrder.findFirst({
    where: { orderToken },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      orderToken: true,
      merchizeExternalOrderNumber: true,
      merchizeOrderCode: true,
      merchizeIdentifier: true,
      merchizeOrderId: true,
    },
  });

  if (!order) {
    return {
      ok: false,
      orderToken,
      attempted: [],
      failed: [
        {
          action: 'external_order_progress',
          errorCode: 'MERCHIZE_FULFILLMENT_OPS_ORDER_NOT_FOUND',
          errorMessage: 'Merchize Fulfillment Ops order was not found.',
        },
      ],
    };
  }

  const orderRow = order;
  const reference = buildReference(orderRow);
  const requestSummary = {
    code: 'code' in reference ? (reference.code ?? '') : '',
    external_number: 'externalNumber' in reference ? reference.externalNumber : '',
    identifier: reference.identifier ?? '',
  };
  const attempted: SnapshotAction[] = [];
  const failed: SnapshotResult['failed'] = [];

  async function runSnapshot<T>(
    action: SnapshotAction,
    request: () => Promise<unknown>,
    persist: (payload: unknown) => Promise<T>,
  ) {
    attempted.push(action);
    const attempt = await prisma.merchizeFulfillmentSyncAttempt.create({
      data: {
        merchizeFulfillmentOrderId: orderRow.id,
        orderToken: orderRow.orderToken,
        action,
        status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
        requestSummary: summarizeProviderRequest(requestSummary),
      },
    });

    try {
      const payload = await request();
      const payloadRecord = asRecord(payload);
      if (payloadRecord?.success === false) {
        throw new MerchizeApiError(
          asString(payloadRecord.message) ?? `Merchize rejected the ${action} snapshot request.`,
          {
            code: `MERCHIZE_${action.toUpperCase()}_REJECTED`,
            responseSummary: payload,
          },
        );
      }
      const result = await persist(payload);
      await prisma.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED,
          responseSummary: summarizeProviderResponse(payload),
          finishedAt: new Date(),
        },
      });
      return result;
    } catch (error) {
      const snapshotError = getSnapshotError(error);
      failed.push({
        action,
        errorCode: snapshotError.code,
        errorMessage: snapshotError.message,
      });
      await prisma.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
          errorCode: snapshotError.code,
          errorMessage: snapshotError.message,
          responseSummary: summarizeProviderResponse(snapshotError.responseSummary),
          finishedAt: new Date(),
        },
      });
      return null;
    }
  }

  const invoiceSnapshot =
    options.includeInvoice === false
      ? null
      : runSnapshot(
          'external_order_invoice',
          () => getMerchizeExternalOrderInvoice(reference),
          async (payload) => {
            if (readSupplierInvoice(payload, orderRow).state === 'provider_error') {
              throw new MerchizeApiError('Could not verify the supplier invoice for this order.', {
                code: 'MERCHIZE_EXTERNAL_ORDER_INVOICE_UNVERIFIED',
              });
            }
            await prisma.merchizeFulfillmentOrder.updateMany({
              where: { id: orderRow.id, duplicateDetectedAt: null },
              data: {
                merchizeFulfillmentCostPayload: toOptionalPrismaJson(payload),
                lastCostCheckAt: new Date(),
              },
            });
          },
        );

  const lifecycleReference = externalOrderLifecycleReference(orderRow);
  const writer = externalOrderLifecycleWriter(prisma, orderRow);
  const progressSnapshot = runSnapshot(
    'external_order_progress',
    () => getMerchizeExternalOrderProgress(lifecycleReference),
    writer.saveProgress,
  );
  await Promise.all([
    progressSnapshot,
    runSnapshot(
      'external_order_tracking',
      () => getMerchizeExternalOrderTracking(lifecycleReference),
      (payload) => writer.saveTracking(payload, progressSnapshot),
    ),
    runSnapshot(
      'external_order_tickets',
      () => listMerchizeExternalOrdersTickets([reference]),
      async (payload) => {
        await prisma.merchizeFulfillmentOrder.update({
          where: { id: orderRow.id },
          data: {
            merchizeTicketsPayload: toOptionalPrismaJson(payload),
            lastTicketSyncAt: new Date(),
          },
        });
      },
    ),
    ...(invoiceSnapshot ? [invoiceSnapshot] : []),
  ]);

  if (orderRow.merchizeOrderId) {
    await Promise.all([
      runSnapshot(
        'provider_order_history',
        () => getMerchizeOrderHistory(orderRow.merchizeOrderId as string),
        async (payload) => {
          await prisma.merchizeFulfillmentOrder.update({
            where: { id: orderRow.id },
            data: {
              merchizeHistoryPayload: toOptionalPrismaJson(payload),
              lastHistorySyncAt: new Date(),
            },
          });
        },
      ),
      runSnapshot(
        'provider_internal_progress',
        () => getMerchizeOrderProgress(orderRow.merchizeOrderId as string),
        async (payload) => {
          await prisma.merchizeFulfillmentOrder.update({
            where: { id: orderRow.id },
            data: {
              merchizeInternalProgressPayload: toOptionalPrismaJson(payload),
            },
          });
        },
      ),
      runSnapshot(
        'provider_send_to_fulfillment',
        () => getMerchizeSendToFulfillmentDate(orderRow.merchizeOrderId as string),
        async (payload) => {
          await prisma.merchizeFulfillmentOrder.update({
            where: { id: orderRow.id },
            data: {
              merchizeSendToFulfillmentPayload: toOptionalPrismaJson(payload),
            },
          });
        },
      ),
      runSnapshot(
        'provider_transaction_fee',
        () => getMerchizeTransactionFee(orderRow.merchizeOrderId as string),
        async (payload) => {
          await prisma.merchizeFulfillmentOrder.update({
            where: { id: orderRow.id },
            data: {
              merchizeTransactionFeePayload: toOptionalPrismaJson(payload),
            },
          });
        },
      ),
    ]);
  }

  await refreshPaidOrderRecoveryProjectionSafely(orderToken);

  return {
    ok: failed.length === 0,
    orderToken,
    attempted,
    failed,
  };
}
