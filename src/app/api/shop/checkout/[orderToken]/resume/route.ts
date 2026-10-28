import { NextResponse } from 'next/server';
import { getOriginalCheckout } from '@/lib/shop/checkout/originalCheckoutServer';
import { checkoutPrivateHeaders, checkoutRequestFailure } from '@/lib/shop/checkout/serverRequest';

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
