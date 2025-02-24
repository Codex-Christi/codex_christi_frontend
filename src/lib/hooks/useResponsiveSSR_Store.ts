'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { create } from 'zustand';
import { useMediaQuery } from 'react-responsive';

// ✅ Define Types
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

// ✅ Zustand Store
const useResponsiveSSRStore = create<ResponsiveStore>((set) => ({
  responsiveState: {
    isClient: false,
    isDesktopOnly: false,
    isTabletOnly: false,
    isMobile: true,
    isTabletAndAbove: false,
    isMobileAndTablet: false,
  },
  setResponsiveState: (newState) => set({ responsiveState: newState }),
}));

// ✅ Custom Hook: Runs at the top level
export function useResponsiveSSRInitial() {
  const setResponsiveState = useResponsiveSSRStore(
    (state) => state.setResponsiveState
  );

  const isMobile = useMediaQuery({ maxWidth: 767 });
  const isMobileAndTablet = useMediaQuery({ maxWidth: 1023 });
  const isTabletOnly = useMediaQuery({ minWidth: 768, maxWidth: 1023 });
  const isTabletAndAbove = useMediaQuery({ minWidth: 768 });
  const isDesktopOnly = useMediaQuery({ minWidth: 1024 });

  // Memoize the values to prevent recalculating media queries on every render
  const memoizedBools = useMemo(() => {
    return {
      isDesktopOnly: isDesktopOnly,
      isTabletOnly: isTabletOnly,
      isMobile: isMobile,
      isTabletAndAbove: isTabletAndAbove,
      isMobileAndTablet: isMobileAndTablet,
    };
  }, [
    isDesktopOnly,
    isMobile,
    isMobileAndTablet,
    isTabletAndAbove,
    isTabletOnly,
  ]);

  const updateRespState = useCallback(
    () => setResponsiveState(memoizedBools),
    [memoizedBools, setResponsiveState]
  );

  updateRespState();
}

// ✅ Hook to Access Zustand Store
export const useResponsiveSSRValue = () => {
  const responsiveState = useResponsiveSSRStore(
    (state) => state.responsiveState
  );

  useEffect(() => {
    console.log(responsiveState);
  }, [responsiveState]);
  return responsiveState;
};
