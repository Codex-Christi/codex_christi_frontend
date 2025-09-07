'use client';

import { ReactNode, FC } from 'react';
import FaviconUpdater from '../general/Helpers/FaviconUpdater';
import { Toaster } from '../primitives/sonner';
import dynamic from 'next/dynamic';

const NextProgressProvider = dynamic(() => import('./ProgressProvider'));
const ResponsiveMediaProvider = dynamic(() => import('./ResponsiveMediaQueryProvider'));
const UserMainProfileStoreInitializer = dynamic(() => import('./UserMainProfileStoreInitializer'));
const LoggedinProvider = dynamic(() => import('./LoggedinProvider'));

const AllRootProviders: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <>
      <FaviconUpdater />
      <Toaster richColors />
      <ResponsiveMediaProvider>
        <UserMainProfileStoreInitializer />
        <LoggedinProvider>
          <NextProgressProvider>{children}</NextProgressProvider>
        </LoggedinProvider>
      </ResponsiveMediaProvider>
    </>
  );
};

export default AllRootProviders;
