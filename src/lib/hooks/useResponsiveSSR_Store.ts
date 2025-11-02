'use client';

import { useMemo, useCallback } from 'react';
import { create } from 'zustand';
import { useMediaQuery } from 'react-responsive';

// ✅ Types
interface ResponsiveState {
  isDesktopOnly: boolean;
  isTabletOnly: boolean;
  isMobile: boolean;
  isTabletAndAbove: boolean;
  isMobileAndTablet: boolean;
}

interface ResponsiveStore {
  responsiveState: ResponsiveState;
  setResponsiveState: (newState: ResponsiveState) => void;
}

// ✅ Shallow compare for small objects
const shallowEqual = (a: ResponsiveState, b: ResponsiveState) =>
  a.isDesktopOnly === b.isDesktopOnly &&
  a.isTabletOnly === b.isTabletOnly &&
  a.isMobile === b.isMobile &&
  a.isTabletAndAbove === b.isTabletAndAbove &&
  a.isMobileAndTablet === b.isMobileAndTablet;

// ✅ Zustand Store (SSR-safe defaults: assume mobile)
const useResponsiveSSRStore = create<ResponsiveStore>()((set, get) => ({
  responsiveState: {
    isDesktopOnly: false,
    isTabletOnly: false,
    isMobile: true,
    isTabletAndAbove: false,
    isMobileAndTablet: true,
  },
  setResponsiveState: (newState) => {
    const prev = get().responsiveState;
    if (!shallowEqual(prev, newState)) {
      set({ responsiveState: newState });
    }
  },
}));

// ✅ Custom Hook: compute with minimal queries, derive the rest
export function useResponsiveSSRInitial() {
  const setResponsiveState = useResponsiveSSRStore((s) => s.setResponsiveState);

  // Only 3 queries; the rest are derived
  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isTabletAndAbove = useMediaQuery({ minWidth: 768 });
  const isDesktopOnly = useMediaQuery({ minWidth: 1024 });

  // Derivations (no extra queries)
  const memoizedBools = useMemo<ResponsiveState>(() => {
    const isMobileAndTablet = !isDesktopOnly; // < 1024
    const isTabletOnly = isTabletAndAbove && !isDesktopOnly; // 768–1023
    return {
      isMobile,
      isTabletAndAbove,
      isDesktopOnly,
      isMobileAndTablet,
      isTabletOnly,
    };
  }, [isMobile, isTabletAndAbove, isDesktopOnly]);

  const updateRespState = useCallback(() => {
    setResponsiveState(memoizedBools);
  }, [memoizedBools, setResponsiveState]);

  // Same return shape, no breaking changes
  return {
    isDesktopOnly,
    isTabletOnly: memoizedBools.isTabletOnly,
    isMobile,
    isTabletAndAbove,
    isMobileAndTablet: memoizedBools.isMobileAndTablet,
    updateRespState,
  };
}

// ✅ Hook to Access Zustand Store
export const useResponsiveSSRValue = () =>
  useMemo(() => {
    const ssrVal = useResponsiveSSRStore.getState().responsiveState;
    return ssrVal;
  }, []);
