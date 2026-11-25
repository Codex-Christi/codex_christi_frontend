import 'server-only';

import { emailSchema } from '@/lib/formSchemas/auth-fields';
import { resolveShopOpsDataTarget } from '@/lib/prisma/shop/shopOpsDataTarget';
import { CANONICAL_SITE_ORIGINS, getSiteHostnameAliases } from '@/lib/siteBaseUrls';

const productionHosts = new Set(
  Object.values(CANONICAL_SITE_ORIGINS).flatMap((url) =>
    getSiteHostnameAliases(new URL(url).hostname),
  ),
);
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

function readDevelopmentOrigin(value: string | undefined) {
  const input = value?.trim();
  const url = input && URL.canParse(input) ? new URL(input) : null;
  if (
    !url ||
    url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    productionHosts.has(url.hostname.replace(/\.$/u, '')) ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && loopbackHosts.has(url.hostname)))
  ) return null;
  return url.origin;
}

export function resolveOrderNotificationDelivery(
  recipient: string,
  orderToken: string,
  env = process.env,
) {
  const target = resolveShopOpsDataTarget(env);
  if (!target.aligned) return null;
  if (target.target === 'prod') {
    return target.nodeEnv === 'production' ? { recipient, test: false as const } : null;
  }
  if (target.target !== 'dev') return null;

  const inbox = emailSchema.safeParse(env.SHOP_DEV_ORDER_EMAIL_INBOX);
  const origin = readDevelopmentOrigin(env.SHOP_DEV_ORDER_CONFIRMATION_ORIGIN);
  if (!inbox.success || !origin) return null;

  // Use deployment settings, not a request header or an order's stored origin.
  return {
    recipient: inbox.data,
    test: true as const,
    confirmationUrl: new URL(
      `/shop/checkout/confirmation/${encodeURIComponent(orderToken)}?view=details`,
      origin,
    ).href,
  };
}
