'use client';

import { ReactNode, FC } from 'react';
import FaviconUpdater from '../general/Helpers/FaviconUpdater';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const LoggedinProvider = dynamic(() => import('./LoggedinProvider'));

const NextProgressProvider = dynamic(() => import('./ProgressProvider'), { ssr: false });
const Toaster = dynamic(() => import('../primitives/sonner').then((mod) => mod.Toaster), {
  ssr: false,
});
const ResponsiveMediaProvider = dynamic(() => import('./ResponsiveMediaQueryProvider'), {
  ssr: false,
});

const AllRootProviders: FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const needsResponsiveMediaProvider = pathname.startsWith('/shop/checkout');

  return (
    <>
      <LoggedinProvider>{children}</LoggedinProvider>
      <Toaster richColors />
      {needsResponsiveMediaProvider && <ResponsiveMediaProvider />}
      <FaviconUpdater />
      <NextProgressProvider />
    </>
  );
};

export default AllRootProviders;
