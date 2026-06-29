'use client';

import { useEffect } from 'react';

export function useVisualViewportHeightCssVar(
  isActive: boolean,
  varName = '--checkout-modal-vh',
) {
  useEffect(() => {
    if (!isActive) return;

    const updateViewportHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty(varName, `${height}px`);
    };

    updateViewportHeight();
    window.visualViewport?.addEventListener('resize', updateViewportHeight);
    window.visualViewport?.addEventListener('scroll', updateViewportHeight);
    window.addEventListener('resize', updateViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateViewportHeight);
      window.visualViewport?.removeEventListener('scroll', updateViewportHeight);
      window.removeEventListener('resize', updateViewportHeight);
      document.documentElement.style.removeProperty(varName);
    };
  }, [isActive, varName]);
}
