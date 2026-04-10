// POST /api/paypal/authorize
import { NextResponse } from 'next/server';
import { OrdersController } from '@paypal/paypal-server-sdk';
import { paypalClient } from '@/lib/paymentClients/paypalClient';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';

const orders = new OrdersController(paypalClient);

export async function POST(req: Request) {
  const { orderToken, orderID } = await req.json();

  if (!orderToken || !orderID) {
    return NextResponse.json({ error: 'orderToken and orderID are required' }, { status: 400 });
  }

  try {
    const intent = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
    });

    if (!intent) {
      return NextResponse.json({ error: 'Intent not found' }, { status: 404 });
    }

    if (!intent.paypalOrderId || intent.paypalOrderId !== orderID) {
      return NextResponse.json({ error: 'PayPal order mismatch' }, { status: 409 });
    }

    const { result } = await orders.authorizeOrder({
      id: orderID,
      prefer: 'return=representation',
    });

    const paypalAuthorizationId =
      result.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id ?? null;

    await paypalTxLedger.paypalIntent.update({
      where: { orderToken },
      data: {
        status: PAYPAL_LEDGER_STATUS.AUTHORIZED,
        paypalAuthorizationId,
        authorizePayload: JSON.parse(JSON.stringify(result)),
      },
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Authorize Error', err);

    await paypalTxLedger.paypalIntent.update({
      where: { orderToken },
      data: {
        status: PAYPAL_LEDGER_STATUS.ERROR,
        lastErrorCode: 'AUTHORIZE_FAILED',
        lastErrorMessage: err instanceof Error ? err.message : String(err),
      },
    });

    return NextResponse.json({ error: 'Failed to authorize' }, { status: 500 });
  }
}
