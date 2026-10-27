import { getProductSearchIndex } from '@/lib/merchizeStorefront/searchCatalog';

export async function GET() {
  try {
    return Response.json(await getProductSearchIndex(), {
      headers: { 'Cache-Control': 'public, max-age=60', 'X-Robots-Tag': 'noindex' },
    });
  } catch {
    return Response.json(
      { error: 'Suggestions are temporarily unavailable.' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
}
