'use client';

import { useCallback, useEffect, useState } from 'react';

type DeferredClientEnhancementOptions = {
  fallbackDelay?: number;
  interactionDelay?: number;
  activateOnInteraction?: boolean;
  activateOnScroll?: boolean;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useDeferredClientEnhancement({
  fallbackDelay = 8000,
  interactionDelay = 0,
  activateOnInteraction = false,
  activateOnScroll = false,
}: DeferredClientEnhancementOptions = {}) {
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const requestReady = useCallback(() => setRequested(true), []);

  useEffect(() => {
    if (ready || requested) return;

    let fallbackTimer: number | null = null;

    const scheduleFallback = () => {
      fallbackTimer = window.setTimeout(requestReady, fallbackDelay);
    };

    if (document.readyState === 'complete') {
      scheduleFallback();
    } else {
      window.addEventListener('load', scheduleFallback, { once: true });
    }

    if (activateOnInteraction) {
      window.addEventListener('pointerdown', requestReady, { once: true, passive: true });
      window.addEventListener('keydown', requestReady, { once: true });
    }

    if (activateOnScroll) {
      window.addEventListener('scroll', requestReady, { once: true, passive: true });
    }

    return () => {
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      window.removeEventListener('load', scheduleFallback);
      window.removeEventListener('pointerdown', requestReady);
      window.removeEventListener('keydown', requestReady);
      window.removeEventListener('scroll', requestReady);
    };
  }, [
    activateOnInteraction,
    activateOnScroll,
    fallbackDelay,
    ready,
    requestReady,
    requested,
  ]);

  useEffect(() => {
    if (!requested || ready) return;

    let idleId: number | null = null;
    const idleWindow = window as IdleWindow;
    const markReady = () => setReady(true);
    const delayTimer = window.setTimeout(() => {
      if (interactionDelay > 0) {
        markReady();
        return;
      }

      if (idleWindow.requestIdleCallback) {
        idleId = idleWindow.requestIdleCallback(markReady, { timeout: 1200 });
      } else {
        markReady();
      }
    }, interactionDelay);

    return () => {
      window.clearTimeout(delayTimer);
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
    };
  }, [interactionDelay, ready, requested]);

  return { ready, requestReady };
}
