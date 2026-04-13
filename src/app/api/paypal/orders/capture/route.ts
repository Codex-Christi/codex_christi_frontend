import { randomUUID } from 'crypto';
import { PaymentsController, type CapturedPayment } from '@paypal/paypal-server-sdk';
import { paypalClient } from '@/lib/paymentClients/paypalClient';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { createPayPalRouteResponders } from '@/lib/paypal/txLedger/routeResponses';

const payments = new PaymentsController(paypalClient);

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

  const persistCapturedResult = async (payload: CapturedPayment) => {
    await paypalTxLedger.paypalIntent.update({
      where: { orderToken },
      data: {
        status: PAYPAL_LEDGER_STATUS.CAPTURED,
        capturePayload: JSON.parse(JSON.stringify(payload)),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
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

    // If capture already succeeded earlier, return the stored payload instead of capturing again.
    if (intent.status === PAYPAL_LEDGER_STATUS.CAPTURED && intent.capturePayload) {
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
    const { result } = await payments.captureAuthorizedPayment({
      authorizationId,
      // A stable request id lets PayPal dedupe retried capture requests.
      paypalRequestId: `capture:${orderToken}`,
      prefer: 'return=representation',
      body: { finalCapture: true },
    });

    try {
      await persistCapturedResult(result);
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
