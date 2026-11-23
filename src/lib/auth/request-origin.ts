import {
  getRequestOrigin,
  getHostnameFromHostHeader,
  getMainSiteHostname,
  getShopSiteHostname,
  getSiteHostnameAliases,
} from '../siteBaseUrls.server';

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try {
    const expected = getRequestOrigin(request.headers, request.url);
    const host = getHostnameFromHostHeader(new URL(expected).host);
    if (
      process.env.NODE_ENV === 'production' &&
      ![
        ...getSiteHostnameAliases(getMainSiteHostname()),
        ...getSiteHostnameAliases(getShopSiteHostname()),
      ].includes(host)
    )
      return false;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}
