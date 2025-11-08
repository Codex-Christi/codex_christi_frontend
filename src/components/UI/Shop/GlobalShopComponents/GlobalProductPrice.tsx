'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import { Skeleton } from '@/components/UI/primitives/skeleton';

type BaseProps = {
  className?: string;
  /** Optional preformatted text from a server wrapper; not required anymore */
  ssrText?: string | null;
  emitJsonLd?: boolean;
  seo?: { sku?: string; url?: string; name?: string; availability?: string };
};

type Props =
  | ({ usdAmount: number; usdCentsBase?: never } & BaseProps)
  | ({ usdAmount?: never; usdCentsBase: number } & BaseProps);

/**
 * Optional drop-in skeleton for Suspense fallbacks in parents:
 *
 * Example:
 *   <Suspense fallback={<PriceSkeleton className="h-5 w-24" />}>
 *     <GlobalProductPrice ... />
 *   </Suspense>
 */
export function PriceSkeleton({ className }: { className?: string }) {
  return <Skeleton className={className ?? 'h-5 w-24 rounded'} />;
}

function formatUSD(major: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(major);
  } catch {
    return `$ ${major.toFixed(2)}`;
  }
}

export default function GlobalProductPrice(props: Props) {
  // Compute a safe initial SSR text if none was provided: format USD using the given base amount.
  const initialText = useMemo(() => {
    if (props.ssrText != null) return props.ssrText;
    const baseCents: number =
      'usdCentsBase' in props
        ? (props.usdCentsBase ?? 0)
        : Math.round((props.usdAmount ?? 0) * 100);
    const major = baseCents / 100;
    return formatUSD(major);
  }, [props]);

  // Initialize with SSR (either provided, or computed USD) so crawlers & first paint see a price.
  const [text, setText] = useState<string | null>(initialText);

  // Store selectors
  const convertUSDCents = useCurrencyCookie((s) => s.convertUSDCents);
  const fx = useCurrencyCookie((s) => s.fx);

  // Determine the immutable base cents for this node
  const baseCents = useMemo<number>(() => {
    if ('usdCentsBase' in props) return props.usdCentsBase ?? 0;
    return Math.round((props.usdAmount ?? 0) * 100);
  }, [props]);

  // Memoize the formatter per currency for efficiency
  const formatter = useMemo(() => {
    if (!fx?.currency) return null;
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: fx.currency });
    } catch {
      return null;
    }
  }, [fx?.currency]);

  // Compute live text when fx/base changes
  useEffect(() => {
    if (baseCents == null || !fx) return; // stay on initial USD until FX exists

    const converted = convertUSDCents(baseCents);
    const major = converted / 100;

    if (formatter) {
      setText(formatter.format(major));
    } else {
      const sym = fx?.currency_symbol || '$';
      setText(`${sym} ${major.toFixed(2)}`);
    }
  }, [baseCents, fx, convertUSDCents, formatter]);

  // Lightweight loading state: show Skeleton when we have neither initial text nor fx yet
  const isLoading = !text && !fx;

  return (
    <>
      {isLoading ? (
        <PriceSkeleton className={props.className} />
      ) : (
        <span
          className={props.className}
          suppressHydrationWarning
          aria-busy={isLoading ? true : undefined}
        >
          {text ?? '—'}
        </span>
      )}
    </>
  );
}
