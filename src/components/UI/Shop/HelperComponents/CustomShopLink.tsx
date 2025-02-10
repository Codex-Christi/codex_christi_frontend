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

  // Parent & shop domains
  const parentSiteProd = 'https://codexchristi.org';
  const shopDomainProd = 'codexchristi.shop';

  // useEffect to get the current domain & detect development mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentDomain = window.location.hostname;
      setDomain(currentDomain);
      setIsDev(currentDomain === 'localhost');
    }
  }, []);

  // Adjusted href based on conditions
  let newHref = href as string;

  if (!isDev && domain === shopDomainProd) {
    if (newHref === '/shop') {
      newHref = '/'; // Ensure "/shop" goes to "/" on the shop domain
    } else if (newHref.startsWith('/shop')) {
      newHref = newHref.replace('/shop', ''); // Strip "/shop" for child routes
    } else if (redirectToParentSite) {
      newHref = `${parentSiteProd}${newHref}`; // Redirect non-shop links to parent site
    }
  }

  return (
    <Link href={newHref} className={className} {...rest}>
      {children}
    </Link>
  );
};

export default CustomShopLink;
