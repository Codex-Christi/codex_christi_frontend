'use client';

import { ProgressProvider } from '@bprogress/next/app';

const NextProgressProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ProgressProvider height='6px' color='#0085FF' options={{ showSpinner: true }} shallowRouting>
      {children}
    </ProgressProvider>
  );
};

export default NextProgressProvider;
