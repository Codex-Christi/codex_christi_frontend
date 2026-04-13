// POST /api/paypal/authorize
import { randomUUID } from 'crypto';
import { OrdersController, type Order, type OrderAuthorizeResponse } from '@paypal/paypal-server-sdk';
import { paypalClient } from '@/lib/paymentClients/paypalClient';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { createPayPalRouteResponders } from '@/lib/paypal/txLedger/routeResponses';

const orders = new OrdersController(paypalClient);
const NON_AUTHORIZABLE_STATUSES = new Set<string>([
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
  PAYPAL_LEDGER_STATUS.COMPLETED,
  PAYPAL_LEDGER_STATUS.REFUNDED,
]);

function getAuthorizationId(payload?: {
  purchaseUnits?: Array<{
    payments?: {
      authorizations?: Array<{ id?: string | null }>;
    };
  }>;
}) {
  return payload?.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id ?? null;
}

async function persistAuthorizedResult(orderToken: string, payload: OrderAuthorizeResponse | Order) {
  const paypalAuthorizationId = getAuthorizationId(payload);

  await paypalTxLedger.paypalIntent.update({
    where: { orderToken },
    data: {
      status: PAYPAL_LEDGER_STATUS.AUTHORIZED,
      paypalAuthorizationId,
      authorizePayload: JSON.parse(JSON.stringify(payload)),
    },
  });
}

async function syncExistingAuthorization(orderID: string, orderToken: string) {
  const { result } = await orders.getOrder({ id: orderID });

  if (!getAuthorizationId(result)) return null;

  await persistAuthorizedResult(orderToken, result);
  return result;
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
    console.error(`[paypal.authorize.${stage}]`, {
      requestId,
      orderToken,
      code,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    if (persistToLedger && orderToken) {
      await paypalTxLedger.paypalIntent.update({
        where: { orderToken },
        data: {
          status: PAYPAL_LEDGER_STATUS.ERROR,
          lastErrorCode: code,
          lastErrorMessage: err instanceof Error ? err.message : String(err),
        },
      });
    }

    return routeError({
      status,
      code,
      stage,
      message,
    });
  };

  try {
    const { orderToken: requestOrderToken, orderID } = await req.json();
    orderToken = requestOrderToken;

    if (!orderToken || !orderID) {
      return validationError('INVALID_AUTHORIZE_REQUEST', 'orderToken and orderID are required');
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

    if (!intent.paypalOrderId || intent.paypalOrderId !== orderID) {
      return routeError({
        status: 409,
        code: 'PAYPAL_ORDER_MISMATCH',
        stage: 'validate_intent',
        message: 'PayPal order mismatch',
      });
    }

    if (intent.status === PAYPAL_LEDGER_STATUS.AUTHORIZED && intent.authorizePayload) {
      return Response.json(intent.authorizePayload);
    }

    // If PayPal already authorized earlier but our ledger write failed, resync instead of reauthorizing.
    if (intent.status === PAYPAL_LEDGER_STATUS.ERROR) {
      try {
        const existingAuthorizedOrder = await syncExistingAuthorization(orderID, orderToken);
        if (existingAuthorizedOrder) {
          return Response.json(existingAuthorizedOrder);
        }
      } catch (syncErr) {
        return fail({
          code: 'AUTHORIZE_RESYNC_FAILED',
          stage: 'resync_authorize_state',
          message: 'Failed to resync existing PayPal authorization state',
          err: syncErr,
          persistToLedger: false,
        });
      }
    }

    if (NON_AUTHORIZABLE_STATUSES.has(intent.status)) {
      return routeError({
        status: 409,
        code: 'AUTHORIZE_STATE_CONFLICT',
        stage: 'validate_intent',
        message: `Cannot authorize intent from status "${intent.status}"`,
      });
    }

    if (
      intent.status !== PAYPAL_LEDGER_STATUS.INTENT_CREATED &&
      intent.status !== PAYPAL_LEDGER_STATUS.ERROR
    ) {
      return routeError({
        status: 409,
        code: 'AUTHORIZE_STATE_INVALID',
        stage: 'validate_intent',
        message: `Unexpected intent status "${intent.status}" before authorize`,
      });
    }

    const { result } = await orders.authorizeOrder({
      id: orderID,
      prefer: 'return=representation',
    });

    try {
      await persistAuthorizedResult(orderToken, result);
    } catch (persistErr) {
      // Keep this distinct so retries know PayPal may already be ahead of the ledger.
      return fail({
        code: 'AUTHORIZE_PERSIST_FAILED',
        stage: 'persist_authorize_payload',
        message: 'PayPal authorization succeeded but ledger persistence failed',
        err: persistErr,
        persistToLedger: false,
      });
    }

    return Response.json(result);
  } catch (err: unknown) {
    return fail({
      code: 'AUTHORIZE_FAILED',
      stage: 'authorize_order',
      message: 'Failed to authorize PayPal order',
      err,
    });
  }
}
