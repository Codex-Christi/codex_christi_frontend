// app/api/img-proxy/route.ts
export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get('src');
  if (!src) {
    return new Response(JSON.stringify({ error: 'Missing `src`' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let imageUrl: string;
  try {
    imageUrl = decodeURIComponent(src);
    new URL(imageUrl); // validity check
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid `src` URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return new Response(null, { status: res.status });

    const contentType = res.headers.get('Content-Type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed fetching image' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
