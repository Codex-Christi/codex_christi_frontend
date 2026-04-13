import { randomUUID } from 'crypto';
import type { Order } from '@paypal/paypal-server-sdk';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { createPayPalOrder } from '@/lib/paypal/createPayPalOrder';
import { paypalRouteError, paypalRouteSuccess } from '@/lib/paypal/txLedger/routeResponses';

export async function POST(req: Request) {
  const requestId = randomUUID();
  let orderToken: string | undefined;
  const validationError = (code: string, message: string) =>
    paypalRouteError({
      status: 400,
      code,
      stage: 'validate_request',
      message,
      requestId,
    });

  const logRouteError = (stage: string, code: string, err: unknown) => {
    console.error(`[paypal.intent.${stage}]`, {
      requestId,
      orderToken,
      code,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  };

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
    logRouteError(stage, code, err);

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

    return paypalRouteError({
      status,
      code,
      stage,
      message,
      requestId,
      orderToken,
    });
  };

  try {
    const body = await req.json();
    const {
      cart,
      customer,
      country,
      country_iso_3,
      initialCurrency,
      delivery_address,
      userId,
      otpOrderId,
    } = body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return validationError('INVALID_CART', 'Cart required');
    }
    if (!customer?.name || !customer?.email) {
      return validationError('INVALID_CUSTOMER', 'Customer required');
    }
    if (!delivery_address) {
      return validationError('INVALID_DELIVERY_ADDRESS', 'Delivery address required');
    }

    orderToken = randomUUID();

    await paypalTxLedger.paypalIntent.create({
      data: {
        orderToken,
        status: PAYPAL_LEDGER_STATUS.INTENT_CREATING,
        customerName: customer.name,
        customerEmail: customer.email,
        userId: userId ?? null,
        otpOrderId: otpOrderId ?? null,
        countryIso2: country ?? null,
        countryIso3: country_iso_3 ?? null,
        initialCurrency: initialCurrency ?? null,
        cartSnapshot: cart,
        shippingSnapshot: delivery_address,
      },
    });

    let paypalOrder: Order;
    try {
      paypalOrder = await createPayPalOrder({
        cart,
        customer,
        country,
        country_iso_3,
        initialCurrency,
        delivery_address,
      });
    } catch (createErr) {
      return fail({
        code: 'CREATE_ORDER_FAILED',
        stage: 'create_paypal_order',
        message: 'Failed to create PayPal order',
        err: createErr,
      });
    }

    if (!paypalOrder?.id) {
      return fail({
        code: 'MISSING_PAYPAL_ORDER_ID',
        stage: 'persist_paypal_order_id',
        message: 'Missing PayPal order ID',
        err: new Error('createPayPalOrder returned no id'),
      });
    }

    try {
      await paypalTxLedger.paypalIntent.update({
        where: { orderToken },
        data: {
          paypalOrderId: paypalOrder.id,
          status: PAYPAL_LEDGER_STATUS.INTENT_CREATED,
        },
      });
    } catch (persistErr) {
      return fail({
        code: 'LEDGER_UPDATE_FAILED',
        stage: 'persist_paypal_order_id',
        message: 'Failed to persist PayPal order details',
        err: persistErr,
      });
    }

    return paypalRouteSuccess({
      requestId,
      data: {
        orderToken,
        paypalOrderId: paypalOrder.id,
      },
    });
  } catch (err) {
    return fail({
      code: 'INTENT_FAILED',
      stage: 'intent_route',
      message: 'Failed to create PayPal intent',
      err,
    });
  }
}
