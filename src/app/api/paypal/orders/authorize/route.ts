// POST /api/paypal/authorize
import { NextResponse } from 'next/server';
import {
  OrdersController,
  Client,
  Environment,
} from '@paypal/paypal-server-sdk';

const client = new Client({
  environment: Environment.Sandbox,
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
  },
});

const orders = new OrdersController(client);

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
