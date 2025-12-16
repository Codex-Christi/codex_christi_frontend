'use client';

import * as React from 'react';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clamp01 = (n: number) => clamp(n, 0, 1);

type EdgeY = 'top' | 'bottom';

/**
 * Hook 1
 * Compare a SOURCE element vs a TARGET element (with optional offset),
 * and return:
 * - isClose / isClashing
 * - a smooth progress 0..1 you can use to fade/transform the SOURCE (or anything)
 *
 * Typical use:
 * - source = fixed mini-summary
 * - target = the real accordion section further down
 * - as target approaches source, progress rises 0->1 (fade out source)
 */
export function useFadeWhenNearTarget(opts: {
  sourceRef: React.RefObject<HTMLElement>;
  targetRef: React.RefObject<HTMLElement>;
  enabled?: boolean;

  /** Which edge of source to compare (default: bottom) */
  sourceEdge?: EdgeY;
  /** Which edge of target to compare (default: top) */
  targetEdge?: EdgeY;

  /**
   * Offset in px added to the "clash line".
   * Example: if target is already partially visible, increase offset
   * so "close" becomes true earlier/later.
   * Default 0.
   */
  offsetPx?: number;

  /**
   * Distance (px) over which progress ramps from 0 -> 1.
   * If you want it to fade quickly, keep this small (ex: 80-160).
   * Default 160.
   */
  fadeDistancePx?: number;

  /**
   * Optional extra: treat as "close" slightly before actual contact.
   * Default 0.
   */
  closeThresholdPx?: number;
}) {
  const {
    sourceRef,
    targetRef,
    enabled = true,
    sourceEdge = 'bottom',
    targetEdge = 'top',
    offsetPx = 0,
    fadeDistancePx = 160,
    closeThresholdPx = 0,
  } = opts;

  const [progress, setProgress] = React.useState(0);
  const [isClose, setIsClose] = React.useState(false);
  const [isClashing, setIsClashing] = React.useState(false);

  const raf = React.useRef<number | null>(null);

  const compute = React.useCallback(() => {
    if (!enabled) return;

    const source = sourceRef.current;
    const target = targetRef.current;
    if (!source || !target) return;

    const s = source.getBoundingClientRect();
    const t = target.getBoundingClientRect();

    const sY = sourceEdge === 'top' ? s.top : s.bottom;
    const tY = targetEdge === 'top' ? t.top : t.bottom;

    /**
     * Define "gap" between the chosen edges.
     * - gap > 0 means target edge is still away from source edge
     * - gap = 0 means touching (with offset)
     * - gap < 0 means overlapping/past (clash)
     */
    const gap = tY - sY - offsetPx;

    // "Close" is a softer boolean (within threshold)
    const close = gap <= closeThresholdPx;
    const clashing = gap <= 0;

    setIsClose(close);
    setIsClashing(clashing);

    /**
     * Progress design:
     * - gap >= fadeDistancePx  => progress = 0 (far away)
     * - gap <= 0              => progress = 1 (fully “taken over” / clashing)
     * - between               => ramps smoothly 0..1
     */
    const p = clamp01(1 - gap / Math.max(1, fadeDistancePx));
    setProgress(p);
  }, [
    enabled,
    sourceRef,
    targetRef,
    sourceEdge,
    targetEdge,
    offsetPx,
    fadeDistancePx,
    closeThresholdPx,
  ]);

  React.useEffect(() => {
    if (!enabled) return;

    const onScrollOrResize = () => {
      if (raf.current) return;
      raf.current = window.requestAnimationFrame(() => {
        raf.current = null;
        compute();
      });
    };

    // run once on mount (your “one time trigger” requirement)
    compute();

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [enabled, compute]);

  return {
    /** 0..1 */
    progress,

    /** Convenience values */
    fadeOut: 1 - progress,
    fadeIn: progress,

    /** Booleans you asked for */
    isClose,
    isClashing,
  };
}

/**
 * Hook 2
 * "Smart pin" logic that is UI-independent.
 *
 * It does NOT force fixed styles.
 * It only tells you:
 * - whether you are in the pinned state
 * - measurements you may want (left/width/top recommendation)
 * - placeholderHeight so YOU can prevent layout jump
 *
 * Why a sentinel?
 * - The sentinel is a tiny div placed in the layout where the pinned element
 *   *would normally sit*. When the element becomes fixed, the sentinel remains
 *   in the flow, so we can still measure the correct left/width alignment.
 */
export function useSmartPin(opts: {
  enabled?: boolean;

  /** Put this where the element “belongs” in normal flow (often an empty div). */
  sentinelRef: React.RefObject<HTMLElement>;

  /** The element you may pin (used for height measuring). */
  elementRef: React.RefObject<HTMLElement>;

  /** When sentinel top crosses this, we pin. (use navbar height here) */
  thresholdTopPx?: number;

  /** Anti-jitter buffer so it doesn't flicker around the threshold. */
  hysteresisPx?: number;
}) {
  const { enabled = true, sentinelRef, elementRef, thresholdTopPx = 24, hysteresisPx = 16 } = opts;

  const [isPinned, setIsPinned] = React.useState(false);
  const [placeholderHeight, setPlaceholderHeight] = React.useState(0);

  // “metrics” you can use for fixed OR absolute OR anything
  const [pinMetrics, setPinMetrics] = React.useState<{
    left: number;
    width: number;
    top: number;
  } | null>(null);

  const raf = React.useRef<number | null>(null);

  const compute = React.useCallback(() => {
    if (!enabled) return;

    const sentinel = sentinelRef.current;
    const el = elementRef.current;
    if (!sentinel || !el) return;

    const sRect = sentinel.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    // Measure height so YOU can render a placeholder when pinned
    setPlaceholderHeight(elRect.height);

    // pin when sentinel goes above thresholdTopPx
    const shouldPin = sRect.top <= thresholdTopPx;
    // unpin when it goes back below threshold + hysteresis
    const shouldUnpin = sRect.top > thresholdTopPx + hysteresisPx;

    setIsPinned((prev) => {
      if (!prev && shouldPin) return true;
      if (prev && shouldUnpin) return false;
      return prev;
    });

    // Always publish metrics (useful even before pinning)
    setPinMetrics({
      left: sRect.left,
      width: sRect.width,
      top: thresholdTopPx,
    });
  }, [enabled, sentinelRef, elementRef, thresholdTopPx, hysteresisPx]);

  React.useEffect(() => {
    if (!enabled) return;

    const onScrollOrResize = () => {
      if (raf.current) return;
      raf.current = window.requestAnimationFrame(() => {
        raf.current = null;
        compute();
      });
    };

    compute();

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [enabled, compute]);

  return {
    /** state */
    isPinned,
    isFixedState: isPinned, // alias (your request)

    /** measurements for you to apply however you like */
    pinMetrics, // { left, width, top } | null

    /** you can render <div style={{height: placeholderHeight}} /> when pinned */
    placeholderHeight,
  };
}
