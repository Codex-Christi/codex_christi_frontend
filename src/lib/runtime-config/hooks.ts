'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  getRuntimeConfigServerSnapshot,
  getRuntimeConfigSnapshot,
  loadPublicRuntimeConfig,
  subscribeToRuntimeConfig,
} from './client';

export function usePublicRuntimeConfigStatus() {
  const snapshot = useSyncExternalStore(
    subscribeToRuntimeConfig,
    getRuntimeConfigSnapshot,
    getRuntimeConfigServerSnapshot,
  );

  useEffect(() => {
    // Initial consumers share a request. A failed request can be retried by calling
    // loadPublicRuntimeConfig again; do not retry indefinitely from this effect.
    if (getRuntimeConfigSnapshot().status === 'loading') {
      void loadPublicRuntimeConfig().catch(() => undefined);
    }
  }, []);

  return snapshot;
}

export function usePublicRuntimeConfig() {
  return usePublicRuntimeConfigStatus().config;
}
