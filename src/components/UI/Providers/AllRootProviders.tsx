'use client';

import { FC } from 'react';
import FaviconUpdater from '../general/Helpers/FaviconUpdater';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useDeferredClientEnhancement } from '@/lib/hooks/useDeferredClientEnhancement';
import { isShopSiteHostname } from '@/lib/siteBaseUrls';

const LoggedinProvider = dynamic(() => import('./LoggedinProvider'));
const CartProvider = dynamic(() => import('./Shop/CartProvider'));

const NextProgressProvider = dynamic(() => import('./ProgressProvider'), { ssr: false });
const Toaster = dynamic(() => import('../primitives/sonner').then((mod) => mod.Toaster), {
  ssr: false,
});
const ResponsiveMediaProvider = dynamic(() => import('./ResponsiveMediaQueryProvider'), {
  ssr: false,
});

function DeferredToaster() {
  const { ready } = useDeferredClientEnhancement({
    fallbackDelay: 9000,
    interactionDelay: 400,
    activateOnInteraction: true,
  });
  return ready ? <Toaster richColors /> : null;
}

function DeferredProgressProvider() {
  const { ready } = useDeferredClientEnhancement({
    fallbackDelay: 9500,
    activateOnInteraction: true,
  });
  return ready ? <NextProgressProvider /> : null;
}

const AllRootProviders: FC = () => {
  const pathname = usePathname();
  const needsResponsiveMediaProvider = pathname.startsWith('/shop/checkout');
  const onShop =
    pathname.startsWith('/shop') ||
    (typeof window !== 'undefined' && isShopSiteHostname(window.location.hostname));

  return (
    <>
      <LoggedinProvider />
      <CartProvider active={onShop} />
      <DeferredToaster />
      {needsResponsiveMediaProvider && <ResponsiveMediaProvider />}
      <FaviconUpdater />
      <DeferredProgressProvider />
    </>
  );
};

export default AllRootProviders;
