'use client';

import { useState, type ComponentProps, type SyntheticEvent } from 'react';
import dynamic from 'next/dynamic';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/primitives/popover';
import { Button } from '@/components/UI/primitives/button';
import { Skeleton } from '@/components/UI/primitives/skeleton';

interface SizeAndColorSelectorPopoverProps {
  buttonProps?: ComponentProps<typeof Button>;
  productId: string;
  productTitle: string;
  productSlug: string;
}

function ProductOptionsSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-12 w-full' />
      <Skeleton className='h-10 w-full' />
    </div>
  );
}

const ProductOptionsContent = dynamic(() => import('./ProductOptionsContent'), {
  loading: ProductOptionsSkeleton,
});

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export default function SizeAndColorSelectorPopover({
  buttonProps,
  productId,
  productTitle,
  productSlug,
}: SizeAndColorSelectorPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button name={`Add ${productTitle} to cart`} {...buttonProps}>
          Add to Cart
        </Button>
      </PopoverTrigger>
      <PopoverContent
        onWheel={stopPropagation}
        onTouchMove={stopPropagation}
        align='start'
        side='top'
        sideOffset={8}
        className={`bg-black/65 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/10 rounded-2xl p-4 shadow-2xl
             shadow-white/60 z-[60] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
             text-white select-none cursor-pointer lg:min-w-[375px] lg:scale-90 !min-h-[300px] transition-[all_.5s]`}
      >
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(closest-side,rgba(0,0,0,1),transparent)]'
          style={{
            background: `radial-gradient(120px 60px at 80% -20%, rgba(80,120,255,.25), transparent),
              radial-gradient(160px 100px at -10% 120%, rgba(0,0,0,.5), transparent)`,
            filter: 'blur(12px)',
          }}
        />

        <div className='max-h-[500px] overflow-y-auto scrollbar px-4 py-5'>
          {isOpen && (
            <ProductOptionsContent
              productId={productId}
              productTitle={productTitle}
              productSlug={productSlug}
              loading={<ProductOptionsSkeleton />}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
