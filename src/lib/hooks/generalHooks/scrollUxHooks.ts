'use client';

import * as React from 'react';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clamp01 = (n: number) => clamp(n, 0, 1);

type FadeOpts = {
  /**
   * Kept for API compatibility.
   * In the current IntersectionObserver (visibility-based) implementation, this ref is not used.
   */
  sourceRef: React.RefObject<HTMLElement>;

  /** In-flow element you’re scrolling toward (usually the full summary wrapper). */
  targetRef: React.RefObject<HTMLElement>;

  enabled?: boolean;

  /**
   * Visibility-based start offset.
   *
   * - If `offsetPx` >= 0: progress stays 0 until at least `offsetPx` vertical pixels of the target are visible.
   * - If `offsetPx` < 0: "pre-trigger" before the target enters from the bottom by `abs(offsetPx)` pixels
   *   (implemented via `IntersectionObserver.rootMargin`).
   */
  offsetPx?: number;

  /**
   * Visibility-based ramp length.
   *
   * - If `rangePx` > 1: treated as pixels. Progress ramps to 1 after `rangePx` additional visible pixels.
   * - If 0 < `rangePx` <= 1: treated as a ratio of the target height (e.g. 0.1 = 10% visible).
   * - If omitted: defaults to target height (or viewport height as a fallback).
   */
  rangePx?: number;

  /**
   * Optional quantization.
   *
   * If set, we:
   * - use it to build a threshold array for smoother IntersectionObserver updates
   * - snap `progress` to N steps (e.g. 100 => 0.01 increments)
   */
  quantizeSteps?: number;
};

/**
 * Visibility-based scroll progress using IntersectionObserver.
 *
 * `progress` increases as more vertical pixels of the target become visible.
 * Use `fadeOut = 1 - progress` to fade out a fixed overlay as the in-flow target appears.
 *
 * Notes:
 * - This implementation avoids per-scroll `getBoundingClientRect()` reads for smoother performance.
 * - `sourceRef` is kept only for API compatibility.
 */
export function useFadeWhenNearTarget(opts: FadeOpts) {
  const {
    // kept for API compatibility (not used in the visibility-based approach)
    targetRef,
    enabled = true,
    offsetPx = 0,
    rangePx,
    quantizeSteps,
  } = opts;

  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (!enabled) return;

    const target = targetRef.current;
    if (!target) return;

    // More thresholds = smoother progress updates.
    // Default to 60 steps unless user explicitly provides quantizeSteps.
    const steps = Math.max(1, Math.floor(quantizeSteps ?? 60));
    const thresholds = Array.from({ length: steps + 1 }, (_, i) => i / steps);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        // Visibility-based progress:
        // - visiblePx: how many vertical pixels of the target are visible in the viewport
        // - offsetPx: how many visible pixels before progress starts moving
        // - rangePx: how many visible pixels needed to reach progress=1
        const visiblePx = entry.intersectionRect?.height ?? 0;
        const targetPx = entry.boundingClientRect?.height ?? 0;

        // If offsetPx is negative, we interpret it as "pre-trigger" pixels
        // (i.e. start progress before the target becomes visible, via rootMargin).
        // In that mode we start at 0 visible pixels.
        const startVisiblePx = offsetPx < 0 ? 0 : Math.max(0, Math.floor(offsetPx));

        // Support `rangePx` as either:
        // - pixels (>= 1)
        // - ratio (0 < rangePx <= 1) of the target's height
        const rampBase =
          typeof rangePx === 'number' && rangePx > 0 && rangePx <= 1
            ? targetPx * rangePx
            : (rangePx ?? targetPx ?? window.innerHeight ?? 1);

        const ramp = Math.max(1, Math.floor(rampBase));

        let p = clamp01((visiblePx - startVisiblePx) / ramp);

        // Optional snap to N steps.
        if (quantizeSteps && quantizeSteps > 0) {
          const q = Math.max(1, Math.floor(quantizeSteps));
          p = clamp01(Math.round(p * q) / q);
        }

        setProgress((prev) => (prev === p ? prev : p));
      },
      {
        root: null,
        threshold: thresholds,
        // Negative offsetPx means: start observing a bit before the element enters the viewport from the bottom.
        // Example: offsetPx = -30 -> start progress ~30px early.
        rootMargin: offsetPx < 0 ? `0px 0px ${Math.abs(Math.floor(offsetPx))}px 0px` : '0px',
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [enabled, targetRef, offsetPx, rangePx, quantizeSteps]);

  // Keep exported API identical.
  return {
    /** 0..1 */
    progress,
    fadeIn: progress,
    fadeOut: 1 - progress,
  };
}

type SmartPinOpts = {
  enabled?: boolean;

  /** A small marker placed where the element “belongs” in flow. */
  sentinelRef: React.RefObject<HTMLElement>;

  /** Optional: the element you’re visually pinning (only used to report placeholder height). */
  elementRef?: React.RefObject<HTMLElement>;

  /** Pin when sentinel top crosses this (px from viewport top). Default 24. */
  thresholdTopPx?: number;

  /** Anti-jitter buffer. Default 16. */
  hysteresisPx?: number;
};

/**
 * Minimal “smart pin” state.
 *
 * It does NOT apply styles.
 * It just tells you when the sentinel has crossed a top threshold.
 */
export function useSmartPin(opts: SmartPinOpts) {
  const { enabled = true, sentinelRef, elementRef, thresholdTopPx = 24, hysteresisPx = 16 } = opts;

  const [isPinned, setIsPinned] = React.useState(false);
  const [placeholderHeight, setPlaceholderHeight] = React.useState(0);

  const compute = React.useCallback(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const sRect = sentinel.getBoundingClientRect();

    const shouldPin = sRect.top <= thresholdTopPx;
    const shouldUnpin = sRect.top > thresholdTopPx + hysteresisPx;

    setIsPinned((prev) => {
      if (!prev && shouldPin) return true;
      if (prev && shouldUnpin) return false;
      return prev;
    });

    const el = elementRef?.current;
    if (el) {
      const h = el.getBoundingClientRect().height;
      setPlaceholderHeight((prev) => (prev === h ? prev : h));
    }
  }, [enabled, sentinelRef, elementRef, thresholdTopPx, hysteresisPx]);

  const rafIdRef = React.useRef<number | null>(null);
  const scheduledRef = React.useRef(false);

  const scheduleCompute = React.useCallback(() => {
    if (!enabled) return;
    if (scheduledRef.current) return;

    scheduledRef.current = true;
    rafIdRef.current = window.requestAnimationFrame(() => {
      scheduledRef.current = false;
      compute();
    });
  }, [enabled, compute]);

  React.useEffect(() => {
    if (!enabled) return;

    const onScrollOrResize = () => scheduleCompute();

    // initial
    scheduleCompute();

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      scheduledRef.current = false;

      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [enabled, scheduleCompute]);

  return {
    isPinned,
    isFixedState: isPinned,
    placeholderHeight,
  };
}
