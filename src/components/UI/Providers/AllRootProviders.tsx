'use client';

import { FC } from 'react';
import FaviconUpdater from '../general/Helpers/FaviconUpdater';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useDeferredClientEnhancement } from '@/lib/hooks/useDeferredClientEnhancement';

const LoggedinProvider = dynamic(() => import('./LoggedinProvider'));

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

  return (
    <>
      <LoggedinProvider />
      <DeferredToaster />
      {needsResponsiveMediaProvider && <ResponsiveMediaProvider />}
      <FaviconUpdater />
      <DeferredProgressProvider />
    </>
  );
};

export default AllRootProviders;
