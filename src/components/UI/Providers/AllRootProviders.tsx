'use client';

import { FC } from 'react';
import FaviconUpdater from '../general/Helpers/FaviconUpdater';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useAfterInitialPageLoad } from '@/lib/hooks/useAfterInitialPageLoad';

const LoggedinProvider = dynamic(() => import('./LoggedinProvider'));

const NextProgressProvider = dynamic(() => import('./ProgressProvider'), { ssr: false });
const Toaster = dynamic(() => import('../primitives/sonner').then((mod) => mod.Toaster), {
  ssr: false,
});
const ResponsiveMediaProvider = dynamic(() => import('./ResponsiveMediaQueryProvider'), {
  ssr: false,
});

function DeferredToaster() {
  const ready = useAfterInitialPageLoad(2200);
  return ready ? <Toaster richColors /> : null;
}

function DeferredProgressProvider() {
  const ready = useAfterInitialPageLoad(2200);
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
