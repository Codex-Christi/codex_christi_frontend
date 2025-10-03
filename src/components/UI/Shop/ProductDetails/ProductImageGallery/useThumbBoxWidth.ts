import { useEffect, useRef, useState } from 'react';

type MaybeArray<T> = T | ReadonlyArray<T>;

function getInlineSize(entry: ResizeObserverEntry): number {
  // Prefer contentBoxSize when available (spec says array; some engines used a single object historically)
  // MDN: contentBoxSize is an array of ResizeObserverSize; older Firefox used a single object.
  // https://developer.mozilla.org/docs/Web/API/ResizeObserverEntry/contentBoxSize
  const cbs = (entry as unknown as { contentBoxSize?: MaybeArray<ResizeObserverSize> })
    .contentBoxSize;

  if (cbs) {
    const size = Array.isArray(cbs) ? cbs[0] : cbs; // narrow to ResizeObserverSize
    if (size && typeof size.inlineSize === 'number') return size.inlineSize;
  }

  // Fallback to contentRect (broader support per MDN)
  // https://developer.mozilla.org/docs/Web/API/ResizeObserverEntry/contentRect
  return entry.contentRect?.width ?? 0;
}

export function useThumbBoxWidth(initial = 80) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(initial);

  useEffect(() => {
    if (!ref.current) return;

    let frame = 0;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      const next = Math.max(40, Math.round(getInlineSize(entry)));
      // schedule state on the next frame to dodge RO “loop limit” warnings
      if (next !== width) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => setWidth(next));
      }
    });

    ro.observe(el);

    // Prime an initial measurement using contentRect to avoid a blank first paint
    // This doesn’t cause hydration mismatch because it runs only on client.
    const rect = el.getBoundingClientRect();
    if (rect.width) setWidth(Math.max(40, Math.round(rect.width)));

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
    // it's OK to omit `width` from deps; RO will fire on size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, width };
}
