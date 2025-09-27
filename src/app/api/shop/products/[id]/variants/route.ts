// app/api/shop/products/[id]/variants/route.ts
import { NextResponse } from 'next/server';

type Params = Promise<{ id: string }>;

export async function GET(req: Request, ctx: { params: Params }) {
  const { id } = await ctx.params; // ✅ await params
  const MERRCHIZE_API_KEY = process.env.MERRCHIZE_API_KEY;

  if (!MERRCHIZE_API_KEY) {
    return NextResponse.json({ error: 'Missing server API token' }, { status: 500 });
  }

  const target = `https://bo-group-2-2.merchize.com/27mkjsl/bo-api/product/products/${encodeURIComponent(id)}/all-variants`;

  try {
    const res = await fetch(target, {
      method: 'GET',
      // keep no-store so Next doesn't serve a cached fetch result
      headers: {
        Accept: 'application/json',
        'X-API-KEY': `${MERRCHIZE_API_KEY}`,
        'User-Agent': 'CodexChristi/1.0 (+https://codexchristi.org)',
      },
      next: { revalidate: 86400 },
    });

    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'text/plain' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
