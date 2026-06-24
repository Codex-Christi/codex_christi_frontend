import 'server-only';

type CheckoutSurfaceProvenance = {
  checkoutSurfaceHost: string | null;
  checkoutSurfaceOrigin: string | null;
  checkoutSurfaceLabel: string | null;
};

function cleanHeaderValue(value: string | null) {
  return value?.split(',')[0]?.trim() || null;
}

function safeUrl(value: string | null) {
  if (!value) return null;

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function hostWithoutPort(host: string | null) {
  if (!host) return null;
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));

  return host.split(':')[0]?.toLowerCase() || null;
}

function isLocalhost(host: string | null) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function isPrivateIpv4(host: string | null) {
  if (!host) return false;

  const parts = host.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [a, b] = parts;

  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function getConfiguredHost(value: string | undefined) {
  return safeUrl(value?.trim() || null)?.hostname.toLowerCase() ?? null;
}

function buildLabel(host: string | null) {
  if (!host) return null;
  if (isLocalhost(host)) return 'localhost development';
  if (isPrivateIpv4(host)) return `${host} local network checkout`;

  const shopHost = getConfiguredHost(process.env.NEXT_PUBLIC_SHOP_SITE_URL);
  const mainHost = getConfiguredHost(process.env.NEXT_PUBLIC_SITE_URL);

  if (shopHost && host === shopHost) return `${host} shop checkout`;
  if (mainHost && host === mainHost) return `${host} main-site checkout`;

  return `${host} checkout`;
}

export function getCheckoutSurfaceProvenance(req: Request): CheckoutSurfaceProvenance {
  const forwardedHost = cleanHeaderValue(req.headers.get('x-forwarded-host'));
  const hostHeader = cleanHeaderValue(req.headers.get('host'));
  const origin = safeUrl(cleanHeaderValue(req.headers.get('origin')));
  const referer = safeUrl(cleanHeaderValue(req.headers.get('referer')));
  const host = hostWithoutPort(origin?.host ?? referer?.host ?? forwardedHost ?? hostHeader);
  const originUrl =
    origin?.origin ??
    (referer ? referer.origin : null) ??
    (hostHeader
      ? `${cleanHeaderValue(req.headers.get('x-forwarded-proto')) ?? 'http'}://${hostHeader}`
      : null);

  return {
    checkoutSurfaceHost: host,
    checkoutSurfaceOrigin: originUrl,
    checkoutSurfaceLabel: buildLabel(host),
  };
}
