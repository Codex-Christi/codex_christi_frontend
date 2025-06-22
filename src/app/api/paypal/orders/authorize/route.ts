// POST /api/paypal/authorize
import { NextResponse } from 'next/server';
import { OrdersController } from '@paypal/paypal-server-sdk';
import { paypalClient } from '@/lib/paymentClients/paypalClient';

const orders = new OrdersController(paypalClient);

export async function POST(req: Request) {
  const { orderID } = await req.json();

  try {
    const { body: resBody } = await orders.authorizeOrder({
      id: orderID,
      prefer: 'return=representation',
    });

    return NextResponse.json(resBody);
  } catch (err: unknown) {
    console.error('Authorize Error', err);
    return NextResponse.json({ error: 'Failed to authorize' }, { status: 500 });
  }
}
