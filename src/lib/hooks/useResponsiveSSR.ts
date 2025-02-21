import { useState, useEffect, useMemo } from 'react';
import { useMediaQuery } from 'react-responsive';

function useResponsiveSSR() {
  const [isClient, setIsClient] = useState(false);

  // Media queries

  const isMobile = useMediaQuery({
    maxWidth: '767px',
  });
  const isMobileAndTablet = useMediaQuery({
    maxWidth: '1023px',
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

  // Set client-side flag after initial render to avoid SSR rendering mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  // Memoize the values to prevent recalculating media queries on every render
  const responsiveState = useMemo(
    () => ({
      isDesktopOnly: isClient ? isDesktopOnly : false,
      isTabletOnly: isClient ? isTabletOnly : false,
      isMobile: isClient ? isMobile : true,
      isTabletAndAbove: isClient ? isTabletAndAbove : false,
      isMobileAndTablet: isClient ? isMobileAndTablet : false,
    }),
    [
      isClient,
      isDesktopOnly,
      isTabletOnly,
      isMobile,
      isTabletAndAbove,
      isMobileAndTablet,
    ]
  );

  return responsiveState;
}

export default useResponsiveSSR;
