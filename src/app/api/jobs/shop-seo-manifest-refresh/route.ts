import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  ShopSeoManifestGenerationLockError,
  generateShopSeoManifest,
} from '@/lib/shop/seoManifest/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cronSecret =
    process.env.SHOP_SEO_MANIFEST_CRON_SECRET ?? process.env.MERCHIZE_OFFLINE_CATALOG_CRON_SECRET;
  const headerSecret = req.headers.get('x-cron-secret');

  if (!cronSecret || headerSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await generateShopSeoManifest();
    for (const path of result.affectedRoutes) {
      revalidatePath(path);
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof ShopSeoManifestGenerationLockError) {
      return NextResponse.json({ ok: false, error: message }, { status: 409 });
    }

    console.error('[shopSeoManifest.cron.failed]', { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
