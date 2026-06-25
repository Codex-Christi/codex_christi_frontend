const MAIN_SITE_BASE_URL_FALLBACK = 'https://codexchristi.org';
const SHOP_SITE_BASE_URL_FALLBACK = 'https://codexchristi.shop';

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  const rawValue = value?.trim() || fallback;

  try {
    const parsedUrl = new URL(rawValue);
    return parsedUrl.toString().replace(/\/+$/, '');
  } catch {
    return fallback;
  }
}

function joinBaseUrl(baseUrl: string, path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function getMainSiteBaseUrl() {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL, MAIN_SITE_BASE_URL_FALLBACK);
}

export function getShopSiteBaseUrl() {
  return normalizeBaseUrl(process.env.NEXT_PUBLIC_SHOP_SITE_URL, SHOP_SITE_BASE_URL_FALLBACK);
}

export function getMainSiteUrl(path = '/') {
  return joinBaseUrl(getMainSiteBaseUrl(), path);
}

export function getShopSiteUrl(path = '/') {
  return joinBaseUrl(getShopSiteBaseUrl(), path);
}

export function getMainSiteHostname() {
  return new URL(getMainSiteBaseUrl()).hostname;
}

export function getShopSiteHostname() {
  return new URL(getShopSiteBaseUrl()).hostname;
}

function matchesConfiguredHostname(hostname: string | null | undefined, configuredHostname: string) {
  if (!hostname) return false;

  const normalizedHostname = getHostnameFromHostHeader(hostname).toLowerCase();
  const normalizedConfiguredHostname = configuredHostname.toLowerCase();

  return (
    normalizedHostname === normalizedConfiguredHostname ||
    normalizedHostname.endsWith(`.${normalizedConfiguredHostname}`)
  );
}

export function getHostnameFromHostHeader(host: string | null | undefined) {
  return host?.split(':')[0]?.toLowerCase() ?? '';
}

function getFirstHeaderValue(value: string | null | undefined) {
  return value?.split(',')[0]?.trim() || null;
}

export function getRequestOrigin(
  requestHeaders: Pick<Headers, 'get'>,
  fallbackUrl?: string,
) {
  const fallback = fallbackUrl ? new URL(fallbackUrl) : null;
  const host =
    getFirstHeaderValue(requestHeaders.get('host')) ??
    getFirstHeaderValue(requestHeaders.get('x-forwarded-host')) ??
    fallback?.host;
  const protocol =
    getFirstHeaderValue(requestHeaders.get('x-forwarded-proto')) ??
    fallback?.protocol.replace(/:$/, '') ??
    'https';

  if (!host) {
    return fallback?.origin ?? getMainSiteBaseUrl();
  }

  return `${protocol}://${host}`;
}

export function getRequestUrl(
  path: string,
  requestHeaders: Pick<Headers, 'get'>,
  fallbackUrl?: string,
) {
  return new URL(path, getRequestOrigin(requestHeaders, fallbackUrl));
}

export function isMainSiteHostname(hostname: string | null | undefined) {
  return matchesConfiguredHostname(hostname, getMainSiteHostname());
}

export function isShopSiteHostname(hostname: string | null | undefined) {
  return matchesConfiguredHostname(hostname, getShopSiteHostname());
}
