import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

export const useAmIOnShopRoute = (givenPath?: string) => {
  const pathname = usePathname();

  const pathToCheck = useMemo(() => {
    return `${givenPath ? (givenPath.startsWith('/') ? givenPath : `/${givenPath}`) : '/'}`;
  }, [givenPath]);

  return useMemo(
    () => ({ youAreOnDesiredShopRoute: pathToCheck === pathname }),
    [pathToCheck, pathname],
  );
};
