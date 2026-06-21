import { randomUUID } from 'crypto';
import { after } from 'next/server';
import { PaymentsController, type CapturedPayment } from '@paypal/paypal-server-sdk';
import { getPayPalClient } from '@/lib/paymentClients/paypalClient';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { createPayPalRouteResponders } from '@/lib/paypal/txLedger/routeResponses';
import { runPaidFulfillmentProcessing } from '@/lib/paypal/txLedger/runPaidFulfillmentProcessing';
import { isCaptureRouteRunnerEnabled } from '@/lib/paypal/txLedger/processingPolicy';
import {
  getPayPalCaptureCompletion,
  type PayPalCaptureCompletion,
} from '@/lib/paypal/txLedger/captureCompletion';

const POST_CAPTURE_RESUMABLE_STATUSES = new Set<string>([
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
  PAYPAL_LEDGER_STATUS.ERROR,
]);

function getLedgerStatusForIncompleteCapture(completion: PayPalCaptureCompletion) {
  if (completion.status === 'PENDING') return PAYPAL_LEDGER_STATUS.PENDING;
  if (completion.status === 'REFUNDED' || completion.status === 'PARTIALLY_REFUNDED') {
    return PAYPAL_LEDGER_STATUS.REFUNDED;
  }

  return PAYPAL_LEDGER_STATUS.ERROR;
}

export async function POST(req: Request) {
  const requestId = randomUUID();

  let orderToken: string | undefined;

  const { error: routeError } = createPayPalRouteResponders({
    requestId,
    getOrderToken: () => orderToken,
  });

  const validationError = (code: string, message: string, status = 400) =>
    routeError({
      status,
      code,
      stage: 'validate_request',
      message,
    });

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
      await paypalTxLedger.paypalIntent
        .update({
          where: { orderToken },
          data: {
            status: PAYPAL_LEDGER_STATUS.ERROR,
            lastErrorCode: code,
            lastErrorMessage: err instanceof Error ? err.message : String(err),
          },
        })
        .catch(() => undefined);
    }
    return routeError({
      status,
      code,
      stage,
      message,
    });
  };

  const persistIncompleteCaptureResult = async (
    payload: CapturedPayment | unknown,
    completion: PayPalCaptureCompletion,
  ) => {
    await paypalTxLedger.paypalIntent.update({
      where: { orderToken },
      data: {
        status: getLedgerStatusForIncompleteCapture(completion),
        capturePayload: JSON.parse(JSON.stringify(payload)),
        lastErrorCode: 'CAPTURE_NOT_COMPLETED',
        lastErrorMessage: completion.reason,
      },
    });
  };

  const persistCapturedResult = async (payload: CapturedPayment) => {
    const completion = getPayPalCaptureCompletion(payload);

    if (!completion.ok) {
      await persistIncompleteCaptureResult(payload, completion);
      return completion;
    }

    await paypalTxLedger.paypalIntent.update({
      where: { orderToken },
      data: {
        status: PAYPAL_LEDGER_STATUS.CAPTURED,
        capturePayload: JSON.parse(JSON.stringify(payload)),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });

    return completion;
  };

  const schedulePostProcessing = (token: string, reason: string) => {
    if (!isCaptureRouteRunnerEnabled()) return;

    after(async () => {
      try {
        await runPaidFulfillmentProcessing(token);
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
    const { authorizationId, orderToken: requestOrderToken } = await req.json();

    orderToken = requestOrderToken;
    if (!authorizationId || !orderToken) {
      return validationError(
        'INVALID_CAPTURE_REQUEST',
        'authorizationId and orderToken are required',
      );
    }
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

    if (intent.paypalAuthorizationId && intent.paypalAuthorizationId !== authorizationId) {
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
        await persistIncompleteCaptureResult(intent.capturePayload, completion).catch(
          () => undefined,
        );
        return routeError({
          status: 409,
          code: 'CAPTURE_NOT_COMPLETED',
          stage: 'validate_stored_capture',
          message: completion.reason,
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
      const completion = await persistCapturedResult(result);

      if (!completion.ok) {
        return routeError({
          status: 409,
          code: 'CAPTURE_NOT_COMPLETED',
          stage: 'capture_payment',
          message: completion.reason,
        });
      }

      schedulePostProcessing(orderToken, 'capture_persisted');
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
    return fail({
      code: 'CAPTURE_FAILED',
      stage: 'capture_payment',
      message: 'Failed to capture PayPal authorization',
      err,
    });
  }
}
