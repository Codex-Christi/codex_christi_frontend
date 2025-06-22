// POST /api/paypal/capture
import { NextResponse } from 'next/server';
import {
  PaymentsController,
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

const payments = new PaymentsController(client);

export async function POST(req: Request) {
  const { authorizationId } = await req.json();

  try {
    const { body: resBody } = await payments.captureAuthorizedPayment({
      authorizationId,
      body: { finalCapture: true },
    });

    return NextResponse.json(resBody);
  } catch (err: unknown) {
    console.error('Capture Error', err);
    return NextResponse.json({ error: 'Failed to capture' }, { status: 500 });
  }
}
