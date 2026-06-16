'use client';

import dynamic from 'next/dynamic';
import { useAfterInitialPageLoad } from '@/lib/hooks/useAfterInitialPageLoad';

const NavCountryDropdownLoaded = dynamic(() => import('./NavCountryDropdownLoaded'), {
  ssr: false,
});

export default function DeferredNavCountryDropdown({ disabled }: { disabled?: boolean }) {
  const ready = useAfterInitialPageLoad(2200);

  if (disabled || !ready) return null;

  return <NavCountryDropdownLoaded />;
}
