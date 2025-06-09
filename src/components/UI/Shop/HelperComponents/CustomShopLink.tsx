'use client';

import Link, { LinkProps } from 'next/link';
import { FC, ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

interface ActiveInactiveProps {
  className?: string;
  children?: ReactNode;
}

interface CustomShopLinkProps extends LinkProps {
  redirectToParentSite?: boolean;
  children?: ReactNode;
  className?: string;
  activeProps?: ActiveInactiveProps;
  inactiveProps?: ActiveInactiveProps;
  ariaLabel?: string;
  id?: string;
}

const CustomShopLink: FC<CustomShopLinkProps> = ({
  redirectToParentSite = false,
  href,
  children,
  className = '', // Default className
  activeProps,
  inactiveProps,
  ariaLabel,
  ...rest
}) => {
  // Hooks
  const pathname = usePathname();
  const [domain, setDomain] = useState<string | null>(null);
  const [isDev, setIsDev] = useState<boolean>(false);
  const [isOnShopRouteParentSite, setIsOnShopRouteParentSite] =
    useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(false);

  // Parent & shop domains
  const parentSiteProdHref = 'https://codexchristi.org';
  const parentSiteProdHostName = 'codexchristi.org';
  const shopDomainProd = 'codexchristi.shop';

  // Get the current domain & detect development mode
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

  // Determine if the link is active
  useEffect(() => {
    if (typeof href === 'string') {
      setIsActive(pathname === href || pathname.startsWith(`${href}/`));
    }
  }, [pathname, href]);

  // Adjusted href based on conditions
  let newHref = href as string;

  if (newHref === '/') {
    if (isOnShopRouteParentSite) {
      newHref = '/shop'; // Ensure "/" keeps them inside the shop
    }
  } else if (!isDev && domain === shopDomainProd) {
    if (newHref.startsWith('/shop')) {
      newHref = newHref.replace('/shop', ''); // Strip "/shop" for shop child routes
    } else if (redirectToParentSite) {
      newHref = `${parentSiteProdHref}${newHref}`; // Redirect non-shop links to parent site
    }
  }

  // Compute final className
  const finalClassName = `${className} ${
    isActive ? activeProps?.className || '' : inactiveProps?.className || ''
  }`.trim();

  // Compute final children
  const finalChildren = isActive
    ? activeProps?.children || children
    : inactiveProps?.children || children;

  return (
    <Link
      href={newHref}
      className={finalClassName}
      aria-label={ariaLabel ? ariaLabel : `Go to ${domain}${pathname} page`}
      {...rest}
    >
      {finalChildren}
    </Link>
  );
};

export default CustomShopLink;
