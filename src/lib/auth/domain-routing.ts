import { getHostnameFromHostHeader, getMainSiteUrl, isShopSiteHostname } from '../siteBaseUrls';
import { getSafeAdminReturnPath } from '../admin/admin-paths';

export type AuthRoutes = ReturnType<typeof getAuthRoutes>;
const SHOP_RETURN_PATHS = [
  '/account-overview',
  '/cart',
  '/checkout',
  '/product',
  '/category',
  '/categories',
];

export function publicShopPath(path: string, hostname: string) {
  if (!isShopSiteHostname(hostname)) return path;
  if (path === '/shop' || path.startsWith('/shop?')) return `/${path.slice(5)}`;
  return path.startsWith('/shop/') ? path.slice(5) : path;
}

export function getAuthRoutes(hostname: string, shop = false) {
  const shopDomain = isShopSiteHostname(getHostnameFromHostHeader(hostname));
  const isShop = shop || shopDomain;
  const prefix = isShop && !shopDomain ? '/shop' : '';
  return {
    shop: isShop,
    prefix,
    login: `${prefix}/auth/${isShop ? 'login' : 'sign-in'}`,
    signup:
      isShop && process.env.NODE_ENV === 'production'
        ? getMainSiteUrl('/auth/signup')
        : '/auth/signup',
    verify: `${prefix}/auth/verify-otp`,
    forgot: `${prefix}/auth/forgot-password`,
    reset: `${prefix}/auth/reset-password`,
    account: isShop ? `${prefix}/account-overview` : '/profile',
  };
}

export function safeAuthReturnPath(value: string | null | undefined, routes: AuthRoutes) {
  if (!value || value.length > 2048 || !value.startsWith('/') || value.startsWith('//'))
    return null;
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://return.invalid');
    if (url.origin !== 'https://return.invalid' || /%(?:2f|5c|0[0-9a-f]|7f|25)/i.test(url.pathname))
      return null;
    const path = url.pathname;
    if (!routes.shop && getSafeAdminReturnPath(path)) return `${path}${url.search}`;
    const allowed = routes.shop
      ? SHOP_RETURN_PATHS.map((path) => `${routes.prefix}${path}`)
      : ['/profile', ...SHOP_RETURN_PATHS.map((path) => `/shop${path}`)];
    if (routes.shop && (path === routes.prefix || path === `${routes.prefix}/`))
      return `${path || '/'}${url.search}`;
    if (!allowed.some((base) => path === base || path.startsWith(`${base}/`))) return null;
    return `${path}${url.search}`;
  } catch {
    return null;
  }
}

export function authFlowUrl(path: string, values: { email?: string; next?: string | null }) {
  const query = new URLSearchParams();
  if (values.email) query.set('email', values.email);
  if (values.next) query.set('next', values.next);
  return `${path}${query.size ? `?${query}` : ''}`;
}
