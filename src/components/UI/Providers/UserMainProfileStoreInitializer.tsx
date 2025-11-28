// stroes/user-main-profile-store-initializer.tsx
'use client';
import { useEffect } from 'react';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import useAuthStore from '@/stores/authStore';

export default function UserMainProfileStoreInitializer() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    console.log(window.location);

    const { _hydrated, setProfileFromServer } = useUserMainProfileStore.getState();
    if (isAuthenticated) setProfileFromServer();
    if (!_hydrated) useUserMainProfileStore.persist.rehydrate();
  }, [isAuthenticated]);

  return null;
}
