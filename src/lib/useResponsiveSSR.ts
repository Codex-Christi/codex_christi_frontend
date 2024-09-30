import { useState, useLayoutEffect } from 'react';
import { useMediaQuery } from 'react-responsive';

function useResponsiveSSR() {
  const [isClient, setIsClient] = useState(false);

  const isMobile = useMediaQuery({
    maxWidth: '767px',
  });

  const isTabletOnly = useMediaQuery({
    minWidth: '768px',
    maxWidth: '1023px',
  });

  const isTabletAndAbove = useMediaQuery({
    minWidth: '768px',
  });

  const isDesktopOnly = useMediaQuery({
    minWidth: '1024px',
  });

  useLayoutEffect(() => {
    if (typeof window !== 'undefined') setIsClient(true);
  }, []);

  return {
    isDesktopOnly: isClient ? isDesktopOnly : false,
    isTabletOnly: isClient ? isTabletOnly : false,
    isMobile: isClient ? isMobile : true,
    isTabletAndAbove: isClient ? isTabletAndAbove : false,
  };
}

export default useResponsiveSSR;
