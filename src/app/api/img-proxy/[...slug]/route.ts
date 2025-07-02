// app/api/image-proxy/[...slug]/route.ts
export const dynamic = 'force-static';
export const runtime = 'edge';

export async function GET(
  req: Request,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug;
  if (!slug || slug.length < 2) {
    return new Response('Invalid proxy URL structure', { status: 400 });
  }

  const filename = slug.pop()!;
  const encodedMeta = slug.join('/');
  const meta = decodeURIComponent(encodedMeta);

  const cloudFrontUrl = `https://d2dytk4tvgwhb4.cloudfront.net/${meta}/${filename}`;
  const response = await fetch(cloudFrontUrl);
  if (!response.ok) return new Response(null, { status: response.status });

  const buffer = await response.arrayBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
