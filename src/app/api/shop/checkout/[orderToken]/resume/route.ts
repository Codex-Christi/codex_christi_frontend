import { NextResponse } from 'next/server';
import {
  acknowledgeOriginalCheckout,
  getOriginalCheckout,
} from '@/lib/shop/checkout/originalCheckoutServer';
import {
  checkoutPrivateHeaders,
  checkoutRequestFailure,
  readCheckoutBody,
} from '@/lib/shop/checkout/serverRequest';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderToken: string }> },
) {
  try {
    const checkout = await getOriginalCheckout((await params).orderToken);
    return NextResponse.json({ checkout }, { headers: checkoutPrivateHeaders });
  } catch (error) {
    return checkoutRequestFailure(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderToken: string }> },
) {
  try {
    const body = await readCheckoutBody(request);
    const result = await acknowledgeOriginalCheckout((await params).orderToken, body, request);
    return NextResponse.json(result, { headers: checkoutPrivateHeaders });
  } catch (error) {
    return checkoutRequestFailure(error);
  }
}
