import 'server-only';

export function getServerDjangoApiBaseUrl() {
  const publicBaseUrl = process.env.NEXT_PUBLIC_DJANGO_API_BASE_URL;
  const internalBaseUrl = process.env.DJANGO_INTERNAL_BASE_URL;
  const shouldPreferInternalBaseUrl =
    process.env.NODE_ENV === 'production' ||
    process.env.DJANGO_PREFER_INTERNAL_BASE_URL === 'true';

  const baseUrl = shouldPreferInternalBaseUrl
    ? internalBaseUrl ?? publicBaseUrl
    : publicBaseUrl ?? internalBaseUrl;

  if (!baseUrl) {
    throw new Error('No Django API base URL is configured');
  }

  return baseUrl.replace(/\/+$/, '');
}
