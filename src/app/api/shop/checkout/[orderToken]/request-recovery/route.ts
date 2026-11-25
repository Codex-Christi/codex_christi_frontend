import { NextResponse } from 'next/server';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { requireCheckoutAccess } from '@/lib/shop/checkout/serverAccess';
import { getCustomerRecoveryRequestState } from '@/lib/shop/checkout/customerRecoveryRequestServer';
import {
  checkoutPrivateHeaders,
  checkoutRequestFailure,
  checkoutString,
  CheckoutRequestError,
  readCheckoutBody,
} from '@/lib/shop/checkout/serverRequest';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderToken: string }> },
) {
  try {
    const body = await readCheckoutBody(request, 256);
    if (Object.keys(body).length) throw new CheckoutRequestError('Invalid recovery request.');
    const orderToken = checkoutString((await params).orderToken, 128);
    const row = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
    if (!row) throw new CheckoutRequestError('Order not found.', 404);

    // Verified status access can request recovery, but this does not issue a payment grant.
    await requireCheckoutAccess(row);
    const now = new Date();
    const state = getCustomerRecoveryRequestState(row, { now });
    if (row.customerRecoveryRequestedAt) {
      return NextResponse.json({ state }, { headers: checkoutPrivateHeaders });
    }
    if (state === 'unavailable')
      throw new CheckoutRequestError('Background recovery is unavailable. Check again later.', 503);
    if (state !== 'available')
      throw new CheckoutRequestError(
        'This order cannot request automatic recovery right now.',
        409,
      );

    const result = await paypalTxLedger.paypalIntent.updateMany({
      where: {
        orderToken,
        userId: row.userId,
        status: row.status,
        updatedAt: row.updatedAt,
        processingCompletedAt: null,
        customerRecoveryRequestedAt: null,
        OR: [{ postProcessingLockExpiresAt: null }, { postProcessingLockExpiresAt: { lt: now } }],
      },
      // Preserve the worker's stale-order cutoff and existing retry timing.
      data: { customerRecoveryRequestedAt: now, updatedAt: row.updatedAt },
    });
    if (result.count === 1) {
      return NextResponse.json(
        { state: 'queued' },
        { status: 202, headers: checkoutPrivateHeaders },
      );
    }

    const current = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
    if (current?.customerRecoveryRequestedAt) {
      await requireCheckoutAccess(current);
      return NextResponse.json(
        { state: getCustomerRecoveryRequestState(current) },
        { headers: checkoutPrivateHeaders },
      );
    }
    throw new CheckoutRequestError(
      'This order changed. Refresh its status before trying again.',
      409,
    );
  } catch (error) {
    return checkoutRequestFailure(error);
  }
}
