import { NextResponse } from 'next/server';
import type { CartVariant } from '@/stores/shop_stores/cartStore';
import { resolveCartOverview } from '@/lib/merchizeStorefront/cartOverview';
import { hasCheckoutBlockingCartItems } from '@/components/UI/Shop/Cart/cartAvailability';

type ShippingEstimatePayload = {
  cart: CartVariant[];
  countryIso3: string;
  stateIso2?: string | null;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ShippingEstimatePayload>;
    const cart = Array.isArray(body?.cart) ? (body.cart as CartVariant[]) : [];
    const countryIso3 =
      typeof body?.countryIso3 === 'string' && body.countryIso3.length === 3
        ? body.countryIso3
        : null;

    if (!countryIso3 || !cart.length) {
      return NextResponse.json(
        { success: false, error: 'Missing cart or country ISO3.' },
        { status: 400 },
      );
    }

    const normalizedIso3 = countryIso3.toUpperCase();
    const verifiedCart = await resolveCartOverview(cart, normalizedIso3);
    if (hasCheckoutBlockingCartItems(cart, verifiedCart.availabilityByVariantId)) {
      return NextResponse.json(
        { success: false, error: 'One or more cart variants are unavailable or unverified.' },
        { status: 409 },
      );
    }

    const totals = verifiedCart.totals;
    if (!totals)
      return NextResponse.json({ success: false, error: verifiedCart.quoteError }, { status: 503 });

    return NextResponse.json({ success: true, totals });
  } catch (error) {
    console.error('[API] Failed to fetch shipping estimate', error);
    return NextResponse.json(
      { success: false, error: 'Unable to compute shipping estimate.' },
      { status: 500 },
    );
  }
}
