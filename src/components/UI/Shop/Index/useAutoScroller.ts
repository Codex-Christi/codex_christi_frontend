'use client';
import { useEffect, useRef, useCallback } from 'react';

type Dir = 'left' | 'right';

type NudgeOpts = {
  fraction?: number; // portion of visible width (0..1)
  duration?: number; // ms
  minPx?: number;
  maxPx?: number;
};

type Options = {
  auto?: boolean; // enable continuous auto-scroll
  respectReducedMotion?: boolean; // default true
  snapManage?: boolean; // temporarily disable scroll-snap
  nudge?: NudgeOpts; // defaults for nudgeScroll
};

export function useAutoScroller(
  containerRef: React.RefObject<HTMLElement>,
  device: { isMobileAndTablet: boolean; isMobile: boolean; isTabletOnly: boolean },
  opts: Options = {},
) {
  const {
    auto = device.isMobileAndTablet,
    respectReducedMotion = true,
    snapManage = true,
    nudge = { fraction: 0.4, duration: 500, minPx: 80, maxPx: 260 },
  } = opts;

  const animFrameRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);
  const directionRef = useRef<Dir>('right');
  const pausedRef = useRef(false);

  // Compute constant velocity (px/s) from container size & device hints
  const computeVelocity = useCallback(
    (el: HTMLElement) => {
      const base = el.clientWidth;
      const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

      return device.isMobile
        ? clamp(base * 0.05, 30, 70) //(-+3, -+20, -+30)
        : device.isTabletOnly
          ? clamp(base * 0.01, 30, 40) //(-+3, -+20, -+40)
          : clamp(base * 0.04, 60, 90); //(-+3, -+20, -+50)
    },
    [device.isMobile, device.isTabletOnly],
  );

  // Hand-like easing nudge
  const handScrollBy = useCallback(
    (dir: Dir, duration = 650, pixels?: number) => {
      const el = containerRef.current;
      if (!el || isAnimatingRef.current) return;

      const maxLeft = el.scrollWidth - el.clientWidth;
      if (maxLeft <= 0) return;

      const derivedStep = Math.min(Math.max(el.clientWidth * 0.4, 80), 260);
      const step = pixels ?? derivedStep;
      const start = el.scrollLeft;
      const delta = dir === 'right' ? step : -step;
      const target = Math.max(0, Math.min(maxLeft, start + delta));
      if (target === start) return;

      isAnimatingRef.current = true;
      let startTs: number | null = null;

      const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

      const tick = (ts: number) => {
        if (startTs === null) startTs = ts;
        const t = Math.min(1, (ts - startTs) / duration);
        el.scrollLeft = start + (target - start) * ease(t);

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          isAnimatingRef.current = false;
          animFrameRef.current = null;
        }
      };

      animFrameRef.current = requestAnimationFrame(tick);
    },
    [containerRef],
  );

  // Public “do-it-all” nudge
  const nudgeScroll = useCallback(
    (dir: Dir, o?: NudgeOpts) => {
      const el = containerRef.current;
      if (!el) return;
      const fraction = o?.fraction ?? nudge.fraction ?? 0.4;
      const duration = o?.duration ?? nudge.duration ?? 500;
      const minPx = o?.minPx ?? nudge.minPx ?? 80;
      const maxPx = o?.maxPx ?? nudge.maxPx ?? 260;
      const step = Math.min(Math.max(el.clientWidth * fraction, minPx), maxPx);
      handScrollBy(dir, duration, step);
    },
    [containerRef, nudge.fraction, nudge.duration, nudge.minPx, nudge.maxPx, handScrollBy],
  );

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);

  // Auto-scroll RAF
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !auto) return;

    if (respectReducedMotion && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const hasOverflow = el.scrollWidth > el.clientWidth + 1;
    if (!hasOverflow) return;

    // style adjustments to reduce micro-jitter
    const prevSnap = el.style.scrollSnapType;
    const prevBehavior = el.style.scrollBehavior;
    const prevWillChange = el.style.willChange;
    if (snapManage) {
      el.style.scrollSnapType = 'none';
      el.style.scrollBehavior = 'auto';
      el.style.willChange = 'scroll-position';
    }

    // speed that adapts to resize
    const speedRef = { current: computeVelocity(el) };
    const ro = new ResizeObserver(() => {
      speedRef.current = computeVelocity(el);
    });
    ro.observe(el);

    let lastTs: number | null = null;

    const frame = (ts: number) => {
      animFrameRef.current = requestAnimationFrame(frame);
      if (pausedRef.current) {
        lastTs = ts;
        return;
      }
      if (lastTs == null) {
        lastTs = ts;
        return;
      }
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      const maxLeft = el.scrollWidth - el.clientWidth;
      if (maxLeft <= 0) return;

      const sgn = directionRef.current === 'right' ? 1 : -1;
      let next = el.scrollLeft + speedRef.current * dt * sgn;

      if (next <= 0) {
        next = 0;
        directionRef.current = 'right';
      } else if (next >= maxLeft) {
        next = maxLeft;
        directionRef.current = 'left';
      }
      el.scrollLeft = next;
    };

    animFrameRef.current = requestAnimationFrame(frame);

    // Interaction: pause/resume (do NOT preventDefault)
    const pauseFn = () => (pausedRef.current = true);
    const resumeFn = () => (pausedRef.current = false);

    let wheelTimeout: number | null = null;
    const onWheel = () => {
      pausedRef.current = true;
      if (wheelTimeout) clearTimeout(wheelTimeout);
      wheelTimeout = window.setTimeout(resumeFn, 250);
    };

    el.addEventListener('pointerdown', pauseFn);
    window.addEventListener('pointerup', resumeFn);
    el.addEventListener('mouseenter', pauseFn);
    el.addEventListener('mouseleave', resumeFn);
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', pauseFn, { passive: true });
    el.addEventListener('touchend', resumeFn, { passive: true });
    el.addEventListener('contextmenu', pauseFn);

    return () => {
      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      ro.disconnect();
      if (snapManage) {
        el.style.scrollSnapType = prevSnap || '';
        el.style.scrollBehavior = prevBehavior || '';
        el.style.willChange = prevWillChange || '';
      }
      el.removeEventListener('pointerdown', pauseFn);
      window.removeEventListener('pointerup', resumeFn);
      el.removeEventListener('mouseenter', pauseFn);
      el.removeEventListener('mouseleave', resumeFn);
      el.removeEventListener('wheel', onWheel as EventListener);
      el.removeEventListener('touchstart', pauseFn as EventListener);
      el.removeEventListener('touchend', resumeFn as EventListener);
      el.removeEventListener('contextmenu', pauseFn as EventListener);
    };
  }, [containerRef, auto, respectReducedMotion, snapManage, computeVelocity]);

  return {
    nudgeScroll,
    pause,
    resume,
    isPaused: pausedRef,
    directionRef,
  };
}
