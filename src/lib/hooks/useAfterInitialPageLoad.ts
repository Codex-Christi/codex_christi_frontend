'use client';

import { useEffect, useState } from 'react';

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useAfterInitialPageLoad(timeout = 1800) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;

    let cancelled = false;
    let cleanupScheduledWork = () => {};
    const idleWindow = window as WindowWithIdleCallback;

    const markReady = () => {
      if (!cancelled) setReady(true);
    };

    const scheduleAfterLoad = () => {
      if (idleWindow.requestIdleCallback) {
        const idleId = idleWindow.requestIdleCallback(markReady, { timeout });
        cleanupScheduledWork = () => idleWindow.cancelIdleCallback?.(idleId);
        return;
      }

      const timeoutId = window.setTimeout(markReady, Math.min(timeout, 900));
      cleanupScheduledWork = () => window.clearTimeout(timeoutId);
    };

    if (document.readyState === 'complete') {
      scheduleAfterLoad();
    } else {
      window.addEventListener('load', scheduleAfterLoad, { once: true });
      cleanupScheduledWork = () => window.removeEventListener('load', scheduleAfterLoad);
    }

    return () => {
      cancelled = true;
      cleanupScheduledWork();
    };
  }, [ready, timeout]);

  return ready;
}
