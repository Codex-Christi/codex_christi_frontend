// POST /api/paypal/capture
import { NextResponse } from 'next/server';
import { PaymentsController } from '@paypal/paypal-server-sdk';
import { paypalClient } from '@/lib/paymentClients/paypalClient';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';

const payments = new PaymentsController(paypalClient);

export async function POST(req: Request) {
  const { orderToken, authorizationId } = await req.json();

  if (!orderToken || !authorizationId) {
    return NextResponse.json(
      { error: 'orderToken and authorizationId are required' },
      { status: 400 },
    );
  }

  try {
    const intent = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
    });

    if (!intent) {
      return NextResponse.json({ error: 'Intent not found' }, { status: 404 });
    }

    if (intent.paypalAuthorizationId && intent.paypalAuthorizationId !== authorizationId) {
      return NextResponse.json({ error: 'Authorization mismatch' }, { status: 409 });
    }

    const { result } = await payments.captureAuthorizedPayment({
      authorizationId,
      body: { finalCapture: true },
    });

    await paypalTxLedger.paypalIntent.update({
      where: { orderToken },
      data: {
        status: PAYPAL_LEDGER_STATUS.CAPTURED,
        capturePayload: JSON.parse(JSON.stringify(result)),
      },
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('Capture Error', err);

    await paypalTxLedger.paypalIntent.update({
      where: { orderToken },
      data: {
        status: PAYPAL_LEDGER_STATUS.ERROR,
        lastErrorCode: 'CAPTURE_FAILED',
        lastErrorMessage: err instanceof Error ? err.message : String(err),
      },
    });

    return NextResponse.json({ error: 'Failed to capture' }, { status: 500 });
  }
}
