import { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from 'react-responsive';

function useTheme() {
  const [isClient, setIsClient] = useState(false);

  // Favicon updating func
  const updateFavicon = useCallback((isDarkMode: boolean) => {
    const linkElement = document.querySelector(
      'link[rel=icon]'
    ) as HTMLLinkElement;

    linkElement.href = `/media/favicons/favicon-${
      isDarkMode ? 'dark' : 'light'
    }-mode.ico`;
  }, []);

  const isDarkMode = useMediaQuery(
    {
      query: '(prefers-color-scheme: dark)',
    },
    undefined,
    (darkModeBool) => {
      updateFavicon(darkModeBool);
    }
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);

      const darkBool = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;

      updateFavicon(darkBool);
    }
  }, [updateFavicon]);

  return {
    isDarkMode: isClient ? isDarkMode : false,
    isLightMode: isClient ? !isDarkMode : true,
  };
}

export default useTheme;
