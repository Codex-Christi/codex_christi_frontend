'use client';

import dynamic from 'next/dynamic';

const ProgressProvider = dynamic(
  () => import('@bprogress/next/app').then((mod) => mod.ProgressProvider),
  { ssr: false },
);

const NextProgressProvider = ({ children }: { children?: React.ReactNode }) => {
  return (
    <ProgressProvider
      height='6px'
      color='#0085FF'
      options={{ showSpinner: true }}
      shallowRouting
      startOnLoad
      spinnerPosition='bottom-right'
    >
      {children}
    </ProgressProvider>
  );
};

export default NextProgressProvider;
