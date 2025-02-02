'use client';

import Link, { LinkProps } from 'next/link';
import { FC, ReactNode, useEffect, useState } from 'react';

interface CustomShopLinkInterface extends LinkProps {
  redirectToParentSite: boolean;
  children?: ReactNode;
  className: string;
}

const CustomShopLink: FC<CustomShopLinkInterface> = (props) => {
  //  Hooks
  const [domain, setDomain] = useState<string | null>(null);

  // Props
  const { redirectToParentSite, href, children, ...rest } = props;

  // Vars
  const parentSiteProd = 'https://codexchristi.org';

  // Bools
  const isShopProdSite = domain === 'https://codexchristi.shop';
  const newHref =
    isShopProdSite && redirectToParentSite ? `${parentSiteProd}${href}` : href;

  // useEffects
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDomain(window.location.origin); // Gets "https://example.com"
    }
  }, []);

  return (
    <Link href={newHref} {...rest}>
      {children}
    </Link>
  );
};

export default CustomShopLink;
