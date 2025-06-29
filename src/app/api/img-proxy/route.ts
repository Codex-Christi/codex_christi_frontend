// app/api/img-proxy/route.ts
export const runtime = 'edge';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const srcParam = url.searchParams.get('src');
  if (!srcParam) {
    return new Response('Missing src', { status: 400 });
  }

  let src: string;
  try {
    src = decodeURIComponent(srcParam);
    new URL(src); // validate it
  } catch {
    return new Response('Invalid src URL', { status: 400 });
  }

  const res = await fetch(src);
  if (!res.ok) return new Response(null, { status: res.status });

  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('Content-Type') ?? 'image/jpeg';

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // No 'jpeg' in filename but PayPal cares only about URL ending
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
