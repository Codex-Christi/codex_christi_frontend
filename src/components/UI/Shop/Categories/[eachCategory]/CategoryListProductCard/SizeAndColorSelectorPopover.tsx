'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Button } from '@/components/UI/primitives/button';

type LoadedPopover = (typeof import('./LoadedCategoryOptionsPopover'))['default'];
let popoverImport: Promise<LoadedPopover> | undefined;

function loadPopover() {
  return (popoverImport ??= import('./LoadedCategoryOptionsPopover')
    .then((module) => module.default)
    .catch((error) => {
      popoverImport = undefined;
      throw error;
    }));
}

const warmPopover = () => void loadPopover().catch(() => {});

interface SizeAndColorSelectorPopoverProps {
  buttonProps?: ComponentProps<typeof Button>;
  productId: string;
  productTitle: string;
  productSlug: string;
}

export default function SizeAndColorSelectorPopover({
  buttonProps,
  productId,
  productTitle,
  productSlug,
}: SizeAndColorSelectorPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [LoadedPopover, setLoadedPopover] = useState<LoadedPopover | null>(null);
  const [loadError, setLoadError] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const isLoading = isOpen && !LoadedPopover && !loadError;

  useEffect(() => {
    if (!isOpen || LoadedPopover || loadError) return;
    let cancelled = false;

    void loadPopover()
      .then((component) => {
        if (!cancelled) setLoadedPopover(() => component);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, LoadedPopover, loadError]);

  useEffect(() => {
    if (!isOpen || LoadedPopover) return;

    const cancelOpening = () => {
      setIsOpen(false);
      setLoadError(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelOpening();
      triggerRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !triggerRef.current?.contains(event.target) &&
        !errorRef.current?.contains(event.target)
      )
        cancelOpening();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen, LoadedPopover]);

  const trigger = (
    <Button
      name={`Add ${productTitle} to cart`}
      {...buttonProps}
      ref={triggerRef}
      className={`${buttonProps?.className ?? ''} relative`}
      aria-haspopup='dialog'
      aria-expanded={Boolean(LoadedPopover && isOpen)}
      aria-busy={isLoading}
      onPointerEnter={(event) => {
        buttonProps?.onPointerEnter?.(event);
        if (!event.defaultPrevented && !buttonProps?.disabled) warmPopover();
      }}
      onFocus={(event) => {
        buttonProps?.onFocus?.(event);
        if (!event.defaultPrevented) warmPopover();
      }}
      onClick={(event) => {
        buttonProps?.onClick?.(event);
        if (event.defaultPrevented || LoadedPopover) return;
        setLoadError(false);
        setIsOpen((open) => loadError || !open);
      }}
    >
      <span className={isLoading ? 'invisible' : undefined}>Add to Cart</span>
      {isLoading && (
        <span aria-hidden='true' className='absolute inset-0 flex items-center justify-center'>
          Loading...
        </span>
      )}
    </Button>
  );

  if (LoadedPopover) {
    return (
      <LoadedPopover
        open={isOpen}
        onOpenChange={setIsOpen}
        trigger={trigger}
        productId={productId}
        productTitle={productTitle}
        productSlug={productSlug}
      />
    );
  }

  return (
    <>
      {trigger}
      {loadError && (
        <div
          ref={errorRef}
          role='alert'
          className='absolute bottom-full right-0 z-30 mb-2 w-56 rounded-md border border-white/20 bg-black px-3 py-2 text-sm text-white shadow-lg'
        >
          <p>Product options could not load.</p>
          <button
            type='button'
            className='mt-1 underline underline-offset-4'
            onClick={() => setLoadError(false)}
          >
            Try again
          </button>
        </div>
      )}
    </>
  );
}
