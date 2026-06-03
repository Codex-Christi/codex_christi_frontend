// app/api/shop/products/[id]/variants/route.ts
import { fetchProductVariants } from '@/app/shop/product/[id]/productDetailsSSR';
import { merchizeErrorStatus } from '@/lib/merchizeStorefront/providerErrors';
import { NextResponse } from 'next/server';

type Params = Promise<{ id: string }>;

export async function GET(req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params; // ✅ await params
  void req;

  try {
    const variants = await fetchProductVariants(id);
    return NextResponse.json({ data: variants });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: merchizeErrorStatus(err) },
    );
  }
}
