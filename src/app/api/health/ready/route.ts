import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    // Validate the local schema without scanning products or contacting suppliers.
    await db.$queryRaw`SELECT 1 FROM "StorefrontProductSnapshot"
      LEFT JOIN "SupplierCatalogProductEvidence" ON 0 LIMIT 1`;
    return Response.json(
      { status: 'ready', revision: process.env.APP_REVISION ?? 'development' },
      { headers }
    );
  } catch {
    console.warn('[readiness] local catalog is unavailable');
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
