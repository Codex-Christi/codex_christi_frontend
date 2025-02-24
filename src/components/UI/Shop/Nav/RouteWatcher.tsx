'use client';

import { Dispatch, FC, SetStateAction, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface RouteWatcherInterface {
  stateSwitcher: Dispatch<SetStateAction<boolean>>;
}

const RouteWatcher: FC<RouteWatcherInterface> = ({ stateSwitcher }) => {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== '/shop') {
      console.log(`Route changed to: ${pathname}`);
      stateSwitcher((prev) => !prev);
    }
    // Perform actions on route change, e.g., analytics, state updates
  }, [pathname, stateSwitcher]);

  return null;
};

export default RouteWatcher;
