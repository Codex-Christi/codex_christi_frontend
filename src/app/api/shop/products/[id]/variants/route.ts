// app/api/shop/products/[id]/variants/route.ts
import { verifyProductForDestination } from '@/lib/merchizeStorefront/productDestinationVerification';
import { normalizeCountryToIso3 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import { merchizeErrorStatus } from '@/lib/merchizeStorefront/providerErrors';
import { NextResponse } from 'next/server';

type Params = Promise<{ id: string }>;

export async function GET(req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params; // ✅ await params
  const rawCountry = new URL(req.url).searchParams.get('country') ?? 'USA';
  const country = normalizeCountryToIso3(rawCountry);
  if (!country)
    return NextResponse.json(
      { error: 'Choose a valid delivery country.' },
      { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
    );

  try {
    req.signal.throwIfAborted();
    const result = await verifyProductForDestination(id, country, { signal: req.signal });
    req.signal.throwIfAborted();
    const verificationIncomplete = result.check.unverifiedCount > 0;

    if (verificationIncomplete && result.variants.length === 0) {
      return NextResponse.json(
        { error: 'Product availability could not be verified. Please try again.' },
        {
          status: 503,
          headers: { 'Cache-Control': 'private, no-store' },
        },
      );
    }

    return NextResponse.json(
      {
        data: result.variants,
        countryName: result.countryName,
        unavailabilityReason: result.reason,
        verificationIncomplete,
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch (err) {
    if (req.signal.aborted)
      return new NextResponse(null, {
        status: 499,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    console.warn('[shop.productOptions] supplier verification failed', {
      productId: id,
      status: merchizeErrorStatus(err),
    });
    return NextResponse.json(
      { error: 'Options are temporarily unavailable. Please try again shortly.' },
      { status: merchizeErrorStatus(err), headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
