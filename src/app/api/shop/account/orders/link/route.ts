import { NextResponse } from 'next/server';
import { linkGuestOrder } from '@/lib/shop/orderHistory/guestLink';
import { readCheckoutBody, CheckoutRequestError } from '@/lib/shop/checkout/serverRequest';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const result = await linkGuestOrder(await readCheckoutBody(request, 2048));
    return NextResponse.json(result, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof CheckoutRequestError
            ? error.message
            : 'Guest order linking is temporarily unavailable.',
      },
      { status: error instanceof CheckoutRequestError ? error.status : 503, headers },
    );
  }
}
