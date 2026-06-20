// src/app/api/jobs/merchize-catalog-refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { refreshMerchizeCatalog } from '@/lib/merchizeCatalog/sync';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.MERCHIZE_OFFLINE_CATALOG_CRON_SECRET;
  const headerSecret = req.headers.get('x-cron-secret');

  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await refreshMerchizeCatalog();
    revalidatePath('/shop');
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error('Merchize refresh failed:', e);
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 500 });
  }
}
