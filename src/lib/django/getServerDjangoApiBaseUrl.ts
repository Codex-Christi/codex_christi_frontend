import 'server-only';

export function getServerDjangoApiBaseUrl() {
  const baseUrl =
    process.env.DJANGO_INTERNAL_BASE_URL ?? process.env.NEXT_PUBLIC_DJANGO_API_BASE_URL;

  if (!baseUrl) {
    throw new Error('No Django API base URL is configured');
  }

  return baseUrl.replace(/\/+$/, '');
}
