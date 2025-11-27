// src/app/api/jobs/merchize-catalog-refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { refreshMerchizeCatalog } from '@/lib/merchizeCatalog/sync';

const CRON_SECRET = process.env.MERCHIZE_PRICE_CATALOG_CRON_SECRET!;

export async function POST(req: NextRequest) {
  const headerSecret = req.headers.get('x-cron-secret');

  if (!CRON_SECRET || headerSecret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await refreshMerchizeCatalog();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error('Merchize refresh failed:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
