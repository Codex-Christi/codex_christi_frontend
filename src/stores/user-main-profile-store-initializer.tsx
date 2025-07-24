// stroes/user-main-profile-store-initializer.tsx
'use client';
import { useEffect } from 'react';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';

export default function UserMainProfileStoreInitializer() {
  useEffect(() => {
    const { _hydrated } = useUserMainProfileStore.getState();
    if (!_hydrated) useUserMainProfileStore.persist.rehydrate();
  }, []);

  return null;
}
