// hooks/useLightboxHistory.ts
import { useEffect, useRef } from 'react';

export const useLightboxHistory = (isOpen: boolean, onClose: () => void) => {
  const isLightboxHistoryEntry = useRef(false);

  useEffect(() => {
    const handlePopState = () => {
      if (isLightboxHistoryEntry.current) {
        onClose();
        isLightboxHistoryEntry.current = false;
      }
    };

    if (isOpen && !isLightboxHistoryEntry.current) {
      // Push a new entry to the history state when the lightbox opens
      window.history.pushState({ lightbox: true }, '');
      isLightboxHistoryEntry.current = true;
    }

    // Listen for the popstate event (e.g., back button press)
    window.addEventListener('popstate', handlePopState);

    return () => {
      // Cleanup: Remove the event listener and the history entry if it exists
      window.removeEventListener('popstate', handlePopState);
      if (isLightboxHistoryEntry.current) {
        window.history.back();
      }
    };
  }, [isOpen, onClose]);
};
