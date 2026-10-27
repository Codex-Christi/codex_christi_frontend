import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

export const useAmIOnShopRoute = (givenPath?: string) => {
  const pathname = usePathname();

  const pathToCheck = useMemo(() => {
    return `${givenPath ? (givenPath.startsWith('/') ? givenPath : `/${givenPath}`) : '/'}`;
  }, [givenPath]);

  return useMemo(
    () => {
      // The shop homepage is public at / and also available at /shop on the parent site.
      const homePaths = ['/', '/shop', '/shop/'];
      return {
        youAreOnDesiredShopRoute:
          pathToCheck === pathname ||
          (homePaths.includes(pathToCheck) && homePaths.includes(pathname)),
      };
    },
    [pathToCheck, pathname],
  );
};
