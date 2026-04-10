import { useEffect, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive';
import { useHasMounted } from './useHasMounted';

function useTheme() {
  const hasMounted = useHasMounted();

  // Favicon updating func
  const updateFavicon = useCallback((isDarkMode: boolean) => {
    const linkElement = document.querySelector('link[rel=icon]') as HTMLLinkElement | null;

    if (linkElement) {
      linkElement.href = `/media/favicons/favicon-${isDarkMode ? 'dark' : 'light'}-mode.ico`;
    }
  }, []);

  const isDarkMode = useMediaQuery(
    {
      query: '(prefers-color-scheme: dark)',
    },
    undefined,
    (darkModeBool) => {
      updateFavicon(darkModeBool);
    },
  );

  useEffect(() => {
    if (!hasMounted) return;
    updateFavicon(isDarkMode);
  }, [hasMounted, isDarkMode, updateFavicon]);

  return {
    isDarkMode: hasMounted ? isDarkMode : false,
    isLightMode: hasMounted ? !isDarkMode : true,
  };
}

export default useTheme;
