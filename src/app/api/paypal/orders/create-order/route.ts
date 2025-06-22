// POST /api/paypal/orders/create-order
import { NextResponse } from 'next/server';
import {
  OrdersController,
  Client,
  Environment,
  CheckoutPaymentIntent,
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
  const body = await req.json();
  const { cart, billingAddress, customer } = body;
  try {
    if (!cart) {
      throw new Error('Missing cart');
    }
    if (!billingAddress) {
      throw new Error('Missing billingAddress');
    }
    if (!customer) {
      throw new Error('Missing customer');
    }

    // 🛡 Validate cart on server (don't trust client prices)
    const totalAmount = '100.00'; // TODO: calculate securely from SKU/DB
    const currencyCode = 'USD';

    const payload = {
      body: {
        intent: 'AUTHORIZE' as CheckoutPaymentIntent,
        purchaseUnits: [
          {
            amount: {
              currencyCode,
              value: totalAmount,
            },
            customId: customer?.email ?? '',
          },
        ],
        payer: {
          name: { givenName: customer.name },
          // address: billingAddress,
          address: { countryCode: 'US' },
          emailAddress: customer.email,
        },
      },
      prefer: 'return=representation',
    };

    const { body: resBody } = await orders.createOrder(payload);

    return NextResponse.json(resBody);
  } catch (err: unknown) {
    console.error('Create Order Error', err);

    return NextResponse.json(err);
  }
}
