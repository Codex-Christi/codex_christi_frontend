import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import type { Order } from '@paypal/paypal-server-sdk';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { createPayPalOrder } from '@/lib/paypal/createPayPalOrder';

export async function POST(req: Request) {
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
      return NextResponse.json({ error: 'Cart required' }, { status: 400 });
    }
    if (!customer?.name || !customer?.email) {
      return NextResponse.json({ error: 'Customer required' }, { status: 400 });
    }
    if (!delivery_address) {
      return NextResponse.json({ error: 'Delivery address required' }, { status: 400 });
    }
    const orderToken = randomUUID();
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
      await paypalTxLedger.paypalIntent.update({
        where: { orderToken },
        data: {
          status: PAYPAL_LEDGER_STATUS.ERROR,
          lastErrorCode: 'CREATE_ORDER_FAILED',
          lastErrorMessage: createErr instanceof Error ? createErr.message : String(createErr),
        },
      });
      return NextResponse.json({ error: 'Create order failed' }, { status: 500 });
    }
    if (!paypalOrder?.id) {
      await paypalTxLedger.paypalIntent.update({
        where: { orderToken },
        data: {
          status: PAYPAL_LEDGER_STATUS.ERROR,
          lastErrorCode: 'MISSING_PAYPAL_ORDER_ID',
          lastErrorMessage: 'createPayPalOrder returned no id',
        },
      });
      return NextResponse.json({ error: 'Missing PayPal order ID' }, { status: 500 });
    }
    await paypalTxLedger.paypalIntent.update({
      where: { orderToken },
      data: {
        paypalOrderId: paypalOrder.id,
        status: PAYPAL_LEDGER_STATUS.INTENT_CREATED,
      },
    });
    return NextResponse.json({
      orderToken,
      paypalOrderId: paypalOrder.id,
    });
  } catch {
    return NextResponse.json({ error: 'Intent failed' }, { status: 500 });
  }
}
