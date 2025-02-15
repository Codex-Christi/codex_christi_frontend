'use client';

import Link, { LinkProps } from 'next/link';
import { FC, ReactNode, useEffect, useState } from 'react';

interface CustomShopLinkInterface extends LinkProps {
  redirectToParentSite?: boolean;
  children?: ReactNode;
  className?: string;
}

const CustomShopLink: FC<CustomShopLinkInterface> = ({
  redirectToParentSite = false,
  href,
  children,
  className,
  ...rest
}) => {
  // Hooks
  const [domain, setDomain] = useState<string | null>(null);
  const [isDev, setIsDev] = useState<boolean>(false);
  const [isOnShopRouteParentSite, setIsOnShopRouteParentSite] =
    useState<boolean>(false);

  // Parent & shop domains
  const parentSiteProdHref = 'https://codexchristi.org';
  const parentSiteProdHostName = 'codexchristi.org';
  const shopDomainProd = 'codexchristi.shop';

  // useEffect to get the current domain & detect development mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentDomain = window.location.hostname;
      setDomain(currentDomain);
      setIsDev(currentDomain === 'localhost');
      setIsOnShopRouteParentSite(
        window.location.pathname.startsWith('/shop') &&
          currentDomain === parentSiteProdHostName
      );
    }
  }, []);

  // Adjusted href based on conditions
  let newHref = href as string;

  if (newHref === '/') {
    // If user clicks "/", we determine the correct behavior
    if (isOnShopRouteParentSite) {
      newHref = '/shop'; // Ensure "/" keeps them inside the shop
    }
  } else if (!isDev && domain === shopDomainProd) {
    // Only modify links on domain.shop in production
    if (newHref.startsWith('/shop')) {
      newHref = newHref.replace('/shop', ''); // Strip "/shop" for shop child routes
    } else if (redirectToParentSite) {
      newHref = `${parentSiteProdHref}${newHref}`; // Redirect non-shop links to parent site
    }
  }

  return (
    <Link href={newHref} className={className} {...rest}>
      {children}
    </Link>
  );
};

export default CustomShopLink;
