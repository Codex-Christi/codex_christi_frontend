// These are the stable public canonical URLs, not deployment settings. Static
// metadata can use them without making every page render on demand.
export const CANONICAL_SITE_ORIGINS = Object.freeze({
  siteUrl: 'https://codexchristi.org',
  shopSiteUrl: 'https://codexchristi.shop',
});

export type SiteOrigins = {
  siteUrl?: string;
  shopSiteUrl?: string;
};

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

export function getMainSiteBaseUrl(origins?: SiteOrigins | null) {
  return normalizeBaseUrl(origins?.siteUrl, CANONICAL_SITE_ORIGINS.siteUrl);
}

export function getShopSiteBaseUrl(origins?: SiteOrigins | null) {
  return normalizeBaseUrl(origins?.shopSiteUrl, CANONICAL_SITE_ORIGINS.shopSiteUrl);
}

export function getMainSiteUrl(path = '/', origins?: SiteOrigins | null) {
  return joinBaseUrl(getMainSiteBaseUrl(origins), path);
}

export function getShopSiteUrl(path = '/', origins?: SiteOrigins | null) {
  return joinBaseUrl(getShopSiteBaseUrl(origins), path);
}

export function getMainSiteHostname(origins?: SiteOrigins | null) {
  return new URL(getMainSiteBaseUrl(origins)).hostname;
}

export function getShopSiteHostname(origins?: SiteOrigins | null) {
  return new URL(getShopSiteBaseUrl(origins)).hostname;
}

// www and apex are both public entry points. Do not manufacture www.www when
// the environment selects the www address as its preferred URL.
export function getSiteHostnameAliases(hostname: string) {
  const apex = hostname.toLowerCase().replace(/^www\./, '');
  return [apex, `www.${apex}`];
}

function matchesConfiguredHostname(hostname: string | null | undefined, configuredHostname: string) {
  if (!hostname) return false;

  const normalizedHostname = getHostnameFromHostHeader(hostname).toLowerCase();
  const normalizedConfiguredHostname = configuredHostname.toLowerCase();

  return (
    getSiteHostnameAliases(normalizedConfiguredHostname).includes(normalizedHostname) ||
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
  origins?: SiteOrigins | null,
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
    return fallback?.origin ?? getMainSiteBaseUrl(origins);
  }

  return `${protocol}://${host}`;
}

export function getRequestUrl(
  path: string,
  requestHeaders: Pick<Headers, 'get'>,
  fallbackUrl?: string,
  origins?: SiteOrigins | null,
) {
  return new URL(path, getRequestOrigin(requestHeaders, fallbackUrl, origins));
}

export function isMainSiteHostname(hostname: string | null | undefined, origins?: SiteOrigins | null) {
  return matchesConfiguredHostname(hostname, getMainSiteHostname(origins));
}

export function isShopSiteHostname(hostname: string | null | undefined, origins?: SiteOrigins | null) {
  return matchesConfiguredHostname(hostname, getShopSiteHostname(origins));
}
