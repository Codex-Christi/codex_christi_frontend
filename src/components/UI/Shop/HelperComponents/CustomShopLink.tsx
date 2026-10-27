'use client';

import Link, { LinkProps } from 'next/link';
import { CSSProperties, FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useHasMounted } from '@/lib/hooks/useHasMounted';
import { publicShopPath } from '@/lib/auth/domain-routing';
import { getMainSiteBaseUrl, isMainSiteHostname, isShopSiteHostname } from '@/lib/siteBaseUrls';

interface ActiveInactiveProps {
  className?: string;
  children?: ReactNode;
}

export interface CustomShopLinkProps extends LinkProps {
  redirectToParentSite?: boolean;
  children?: ReactNode;
  className?: string;
  activeProps?: ActiveInactiveProps;
  inactiveProps?: ActiveInactiveProps;
  ariaLabel?: string;
  id?: string;
  style?: CSSProperties;
  tabIndex?: number;
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
  const hasMounted = useHasMounted();

  // Parent & shop domains
  const parentSiteProdHref = getMainSiteBaseUrl();
  const domain = hasMounted ? window.location.hostname : null;
  const isDev = domain === 'localhost';
  const isOnShopRouteParentSite =
    hasMounted && window.location.pathname.startsWith('/shop') && isMainSiteHostname(domain);
  const isActive =
    typeof href === 'string' ? pathname === href || pathname.startsWith(`${href}/`) : false;

  // Adjusted href based on conditions
  let newHref = href;

  if (newHref === '/') {
    if (isOnShopRouteParentSite) {
      newHref = '/shop'; // Ensure "/" keeps them inside the shop
    }
  } else if (typeof newHref === 'string' && !isDev && isShopSiteHostname(domain)) {
    if (newHref === '/shop' || newHref.startsWith('/shop/') || newHref.startsWith('/shop?')) {
      newHref = publicShopPath(newHref, domain ?? '');
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
      aria-label={ariaLabel}
      {...rest}
    >
      {finalChildren}
    </Link>
  );
};

export default CustomShopLink;
