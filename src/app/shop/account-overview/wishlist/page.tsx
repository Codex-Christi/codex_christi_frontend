import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isShopSiteHostname } from '@/lib/siteBaseUrls';

export default async function WishlistRedirect() {
  const requestHeaders = await headers();
  redirect(isShopSiteHostname(requestHeaders.get('host')) ? '/my-wishlist' : '/shop/my-wishlist');
}
