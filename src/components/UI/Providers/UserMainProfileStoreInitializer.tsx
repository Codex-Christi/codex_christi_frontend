// src/components/UI/Providers/UserMainProfileStoreInitializer.tsx
'use client';

import { useEffect } from 'react';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';

/**
 * This component is mounted high in the tree (e.g. in app/layout.tsx).
 * It simply triggers Zustand-persist rehydration on the client once.
 */
export default function UserMainProfileStoreInitializer() {
  useEffect(() => {
    // Hydrate from sessionStorage on client mount
    useUserMainProfileStore.persist.rehydrate();
  }, []);

  return null;
}
