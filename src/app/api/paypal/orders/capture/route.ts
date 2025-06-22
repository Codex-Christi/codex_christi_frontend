// POST /api/paypal/capture
import { NextResponse } from 'next/server';
import { PaymentsController } from '@paypal/paypal-server-sdk';
import { paypalClient } from '@/lib/paymentClients/paypalClient';

const payments = new PaymentsController(paypalClient);

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
