import { NextResponse } from 'next/server';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { requireCheckoutAccess } from '@/lib/shop/checkout/serverAccess';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import { signReceiptDownload } from '@/lib/shop/orderHistory/receiptStorage';
import { receiptObjectKey } from '@/lib/shop/orderHistory/receiptReference';
import { CheckoutRequestError } from '@/lib/shop/checkout/serverRequest';
import { HISTORY_POST_CAPTURE_STATUSES } from '@/lib/shop/orderHistory/model';

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderToken: string }> },
) {
  try {
    const { orderToken } = await params;
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(orderToken))
      return new Response('Receipt not found.', { status: 404, headers });
    const row = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
      select: {
        orderToken: true,
        userId: true,
        djangoOrderIntentUuid: true,
        receiptLink: true,
        receiptFile: true,
        capturePayload: true,
        status: true,
      },
    });
    if (!row) return new Response('Receipt not found.', { status: 404, headers });
    await requireCheckoutAccess(row); // Read-only access: no request argument, ownership claim, or payment grant.
    if (
      (!getPayPalCaptureCompletion(row.capturePayload).ok &&
        !HISTORY_POST_CAPTURE_STATUSES.includes(
          row.status as (typeof HISTORY_POST_CAPTURE_STATUSES)[number],
        )) ||
      !receiptObjectKey(row)
    )
      return new Response('Receipt not found.', { status: 404, headers });
    return NextResponse.redirect(await signReceiptDownload(row), { status: 307, headers });
  } catch (error) {
    return new Response('Receipt unavailable. Reopen your protected order page to verify access.', {
      status: error instanceof CheckoutRequestError ? 403 : 503,
      headers,
    });
  }
}
