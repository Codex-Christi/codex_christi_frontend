import {
  checkoutString,
  CheckoutRequestError,
  checkoutRequestFailure,
  readCheckoutBody,
} from '@/lib/shop/checkout/serverRequest';
import { requireCheckoutAccess } from '@/lib/shop/checkout/serverAccess';
import { randomUUID } from 'crypto';
import { after } from 'next/server';
import { PaymentsController, type CapturedPayment } from '@paypal/paypal-server-sdk';
import { getPayPalClient } from '@/lib/paymentClients/paypalClient';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { createPayPalRouteResponders } from '@/lib/paypal/txLedger/routeResponses';
import { runPaidFulfillmentProcessing } from '@/lib/paypal/txLedger/runPaidFulfillmentProcessing';
import { isCaptureRouteRunnerEnabled } from '@/lib/paypal/txLedger/processingPolicy';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';
import { getCheckoutSurfaceProvenance } from '@/lib/paypal/txLedger/checkoutSurfaceProvenance';
import {
  reconcileCanonicalPayPalAuthorization,
  reconcileCanonicalPayPalPaymentChain,
  type CanonicalPaymentReconciliationResult,
} from '@/lib/paypal/txLedger/canonicalPaymentReconciliation';
import {
  notifyCanonicalPaymentFailure,
  type CanonicalPaymentFailureNotificationContext,
} from '@/lib/paypal/txLedger/canonicalPaymentFailureNotification';
import { commitOptimisticLedgerTransition } from '@/lib/paypal/txLedger/optimisticLedgerTransition';
import {
  buildPayPalCaptureFailureLedgerTransition,
  buildPayPalWebhookLedgerTransition,
} from '@/lib/paypal/txLedger/payPalWebhookLedgerTransition';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';

const POST_CAPTURE_RESUMABLE_STATUSES = new Set<string>([
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
  PAYPAL_LEDGER_STATUS.ERROR,
]);

export async function POST(req: Request) {
  const requestId = randomUUID();
  const checkoutSurface = getCheckoutSurfaceProvenance(req);

  let orderToken: string | undefined;

  const { error: routeError } = createPayPalRouteResponders({
    requestId,
    getOrderToken: () => orderToken,
  });

  const persistCaptureFailure = async (failure: { code: string; message: string }) => {
    await commitOptimisticLedgerTransition({
      load: () => paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } }),
      build: (latest) => {
        const transition = buildPayPalCaptureFailureLedgerTransition(latest, failure);
        return {
          ...transition,
          data: { ...transition.data, ...checkoutSurface },
        };
      },
      commit: async (latest, transition) => {
        const updated = await paypalTxLedger.paypalIntent.updateMany({
          where: { orderToken, status: latest.status, updatedAt: latest.updatedAt },
          data: transition.data as Prisma.PaypalIntentUpdateManyMutationInput,
        });
        return updated.count === 1;
      },
    });
    if (orderToken) await refreshPaidOrderRecoveryProjectionSafely(orderToken);
  };

  // Keep logging, ledger error persistence, and client-safe error responses in one place.
  const fail = async ({
    code,
    stage,
    message,
    err,
    status = 500,
    persistToLedger = true,
  }: {
    code: string;
    stage: string;
    message: string;
    err: unknown;
    status?: number;
    persistToLedger?: boolean;
  }) => {
    console.error(`[paypal.capture.${stage}]`, {
      requestId,
      orderToken,
      code,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    if (persistToLedger && orderToken) {
      await persistCaptureFailure({
        code,
        message: err instanceof Error ? err.message : String(err),
      }).catch(() => undefined);
    }
    return routeError({
      status,
      code,
      stage,
      message,
    });
  };

  const persistCanonicalPaymentFailure = async (
    reconciliation: CanonicalPaymentReconciliationResult,
    payload: CapturedPayment | unknown,
    notificationContext: CanonicalPaymentFailureNotificationContext & {
      status: string;
      updatedAt: Date;
    },
  ) => {
    const changed = await paypalTxLedger.paypalIntent.updateMany({
      where: {
        orderToken,
        status: notificationContext.status,
        updatedAt: notificationContext.updatedAt,
      },
      data: {
        status: PAYPAL_LEDGER_STATUS.ERROR,
        ...(payload === undefined ? {} : { capturePayload: JSON.parse(JSON.stringify(payload)) }),
        lastErrorCode: reconciliation.errorCode,
        lastErrorMessage: reconciliation.reason,
        ...checkoutSurface,
      },
    });
    if (changed.count !== 1) return;
    if (orderToken) await refreshPaidOrderRecoveryProjectionSafely(orderToken);
    if (notificationContext) {
      await notifyCanonicalPaymentFailure(notificationContext, reconciliation);
    }
  };

  const persistCapturedResult = async (payload: CapturedPayment | unknown) => {
    const completion = getPayPalCaptureCompletion(payload);
    const transitionEventType = completion.ok
      ? 'PAYMENT.CAPTURE.COMPLETED'
      : completion.status === 'PENDING'
        ? 'PAYMENT.CAPTURE.PENDING'
        : completion.status === 'REFUNDED' || completion.status === 'PARTIALLY_REFUNDED'
          ? 'PAYMENT.CAPTURE.REFUNDED'
          : completion.status === 'DENIED' || completion.status === 'DECLINED'
            ? 'PAYMENT.CAPTURE.DENIED'
            : 'PAYMENT.CAPTURE.COMPLETED';
    const committed = await commitOptimisticLedgerTransition({
      load: () => paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } }),
      build: (latest) => {
        const transition = buildPayPalWebhookLedgerTransition(latest, transitionEventType, payload);
        const paymentData = { ...(transition.data ?? {}) };
        delete paymentData.lastEventType;
        return {
          ...transition,
          data: { ...paymentData, ...checkoutSurface },
        };
      },
      commit: async (latest, transition) => {
        const updated = await paypalTxLedger.paypalIntent.updateMany({
          where: { orderToken, status: latest.status, updatedAt: latest.updatedAt },
          data: transition.data as Prisma.PaypalIntentUpdateManyMutationInput,
        });
        return updated.count === 1;
      },
    });

    if (orderToken) await refreshPaidOrderRecoveryProjectionSafely(orderToken);
    if (committed.transition.reconciliationFailure) {
      await notifyCanonicalPaymentFailure(
        committed.row,
        committed.transition.reconciliationFailure,
      );
    }

    return {
      completion,
      reconciliation: committed.transition.reconciliationFailure,
      shouldScheduleFulfillment: committed.transition.shouldScheduleFulfillment,
    };
  };

  const schedulePostProcessing = (token: string, reason: string) => {
    if (!isCaptureRouteRunnerEnabled()) return;

    after(async () => {
      try {
        await runPaidFulfillmentProcessing(token, {
          triggerDetail: reason,
          triggerSource: 'capture_route',
        });
      } catch (error) {
        console.error('[paypal.capture.post_processing_failed]', {
          requestId,
          orderToken: token,
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  };

  try {
    const body = await readCheckoutBody(req, 4096);
    const authorizationId = checkoutString(body.authorizationId, 128);
    orderToken = checkoutString(body.orderToken, 128);
    const intent = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
    });

    if (!intent) {
      return routeError({
        status: 404,
        code: 'INTENT_NOT_FOUND',
        stage: 'load_intent',
        message: 'Intent not found',
      });
    }

    await requireCheckoutAccess(intent, true, req);

    if (!intent.paypalAuthorizationId || intent.paypalAuthorizationId !== authorizationId) {
      return routeError({
        status: 409,
        code: 'AUTHORIZATION_MISMATCH',
        stage: 'validate_intent',
        message: 'Authorization mismatch',
      });
    }

    // If capture already succeeded earlier, resume server-side follow-up work instead of
    // attempting another PayPal capture. Webhooks may arrive late or not reach local dev tunnels.
    if (intent.capturePayload && intent.status !== PAYPAL_LEDGER_STATUS.REFUNDED) {
      const completion = getPayPalCaptureCompletion(intent.capturePayload);

      if (!completion.ok) {
        await persistCapturedResult(intent.capturePayload).catch(() => undefined);
        return routeError({
          status: 409,
          code: 'CAPTURE_NOT_COMPLETED',
          stage: 'validate_stored_capture',
          message: completion.reason,
        });
      }

      const paymentChain = reconcileCanonicalPayPalPaymentChain(
        intent,
        intent.authorizePayload,
        intent.capturePayload,
      );
      if (!paymentChain.ok) {
        await persistCanonicalPaymentFailure(
          paymentChain.reconciliation,
          intent.capturePayload,
          intent,
        );
        return routeError({
          status: 409,
          code: paymentChain.reconciliation.errorCode,
          stage: `reconcile_stored_${paymentChain.failedAt}_amount`,
          message: paymentChain.reconciliation.reason,
        });
      }

      if (!intent.processingCompletedAt && POST_CAPTURE_RESUMABLE_STATUSES.has(intent.status)) {
        schedulePostProcessing(orderToken, 'stored_capture_payload');
      }

      return Response.json(intent.capturePayload);
    }

    if (
      intent.status === PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED ||
      intent.status === PAYPAL_LEDGER_STATUS.PAYMENT_SAVED ||
      intent.status === PAYPAL_LEDGER_STATUS.COMPLETED ||
      intent.status === PAYPAL_LEDGER_STATUS.REFUNDED
    ) {
      return routeError({
        status: 409,
        code: 'CAPTURE_STATE_CONFLICT',
        stage: 'validate_intent',
        message: `Cannot capture intent from status "${intent.status}"`,
      });
    }
    if (
      intent.status !== PAYPAL_LEDGER_STATUS.AUTHORIZED &&
      intent.status !== PAYPAL_LEDGER_STATUS.ERROR
    ) {
      return routeError({
        status: 409,
        code: 'CAPTURE_STATE_INVALID',
        stage: 'validate_intent',
        message: `Unexpected intent status "${intent.status}" before capture`,
      });
    }

    const authorizationReconciliation = reconcileCanonicalPayPalAuthorization(
      intent,
      intent.authorizePayload,
    );
    if (!authorizationReconciliation.ok) {
      await persistCanonicalPaymentFailure(authorizationReconciliation, undefined, intent);
      return routeError({
        status: 409,
        code: authorizationReconciliation.errorCode,
        stage: 'reconcile_authorization_amount',
        message: authorizationReconciliation.reason,
      });
    }

    // Main Paymnet Capture from SDK
    const payments = new PaymentsController(getPayPalClient());
    const { result } = await payments.captureAuthorizedPayment({
      authorizationId,
      // A stable request id lets PayPal dedupe retried capture requests.
      paypalRequestId: `capture:${orderToken}`,
      prefer: 'return=representation',
      body: { finalCapture: true },
    });

    try {
      const { completion, reconciliation, shouldScheduleFulfillment } =
        await persistCapturedResult(result);

      if (!completion.ok) {
        return routeError({
          status: 409,
          code: 'CAPTURE_NOT_COMPLETED',
          stage: 'capture_payment',
          message: completion.reason,
        });
      }

      if (reconciliation && !reconciliation.ok) {
        return routeError({
          status: 409,
          code: reconciliation.errorCode,
          stage: 'reconcile_capture_amount',
          message: reconciliation.reason,
        });
      }

      if (shouldScheduleFulfillment) {
        schedulePostProcessing(orderToken, 'capture_persisted');
      }
    } catch (persistErr) {
      // Keep this separate so retries know PayPal may already be ahead of the ledger.
      return fail({
        code: 'CAPTURE_PERSIST_FAILED',
        stage: 'persist_capture_payload',
        message: 'PayPal capture succeeded but ledger persistence failed',
        err: persistErr,
        persistToLedger: false,
      });
    }

    return Response.json(result);
  } catch (err: unknown) {
    if (err instanceof CheckoutRequestError) return checkoutRequestFailure(err);
    return fail({
      code: 'CAPTURE_FAILED',
      stage: 'capture_payment',
      message: 'Failed to capture PayPal authorization',
      err,
    });
  }
}
