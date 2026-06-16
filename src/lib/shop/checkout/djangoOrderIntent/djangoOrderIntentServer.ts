import 'server-only';

import { generateSignatureHeaders } from '@/lib/hooks/shopHooks/checkout/helpers/generateSignatureHeaders';
import { getServerDjangoApiBaseUrl } from '@/lib/django/getServerDjangoApiBaseUrl';

type DjangoOrderIntentEndpoint = '/orders/intent' | '/orders/intent/verify' | '/orders/intent/resend-otp';

export async function postToDjangoOrderIntent<TBody>(
  endpoint: DjangoOrderIntentEndpoint,
  body: TBody,
) {
  const djangoBaseUrl = getServerDjangoApiBaseUrl();

  const response = await fetch(`${djangoBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: await generateSignatureHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? 'application/json';

  return new Response(text, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      'Content-Type': contentType,
    },
  });
}
