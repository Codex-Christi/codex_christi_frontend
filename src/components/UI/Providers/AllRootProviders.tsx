'use client';

import { ReactNode, FC } from 'react';
import FaviconUpdater from '../general/Helpers/FaviconUpdater';
import dynamic from 'next/dynamic';

const LoggedinProvider = dynamic(() => import('./LoggedinProvider'));
const UserMainProfileStoreInitializer = dynamic(() => import('./UserMainProfileStoreInitializer'));
const NextProgressProvider = dynamic(() => import('./ProgressProvider'), { ssr: false });
const Toaster = dynamic(() => import('../primitives/sonner').then((mod) => mod.Toaster), {
  ssr: false,
});
const ResponsiveMediaProvider = dynamic(() => import('./ResponsiveMediaQueryProvider'), {
  ssr: false,
});

const AllRootProviders: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <>
      <LoggedinProvider>{children}</LoggedinProvider>
      <UserMainProfileStoreInitializer />
      <Toaster richColors />
      <ResponsiveMediaProvider />
      <FaviconUpdater />
      <NextProgressProvider />
    </>
  );
};

export default AllRootProviders;
