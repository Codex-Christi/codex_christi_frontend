'use client';

import { FC, ComponentProps, useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/primitives/popover';
import { Button } from '@/components/UI/primitives/button';
import { Skeleton } from '@/components/UI/primitives/skeleton'; // Import shadcn/ui Skeleton
import { AddToCart } from '../../../ProductDetails/AddToCart';
import { BuyNow } from '../../../ProductDetails/BuyNow';
import SizeSelector from '../../../ProductDetails/SizeSelector';
import ColorsSelector from '../../../ProductDetails/ColorsSelector';
import { useProductVariants } from '@/lib/hooks/shopHooks/products/variants/useProductVariants';

interface SizeAndColorSelectorPopoverProps {
  buttonProps?: ComponentProps<typeof Button>;
  productId: string; // The ID of the product to fetch
  productTitle: string;
  productSlug: string;
}

const SizeAndColorSelectorPopover: FC<SizeAndColorSelectorPopoverProps> = ({
  buttonProps,
  productId,
  productTitle,
  productSlug,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data, error, isLoading } = useProductVariants(productId, isOpen);

  // Memoize the popover content to prevent unnecessary re-renders
  const popoverContent = useMemo(
    () => (
      <PopoverContent
        align='start'
        side='top'
        sideOffset={8}
        className={`bg-black/55 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/10 rounded-2xl p-4 shadow-2xl
             shadow-black/40 z-[60] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 
             text-white select-none cursor-pointer lg:min-w-[375px] max-h-[500px] overflow-y-visible lg:scale-90`}
      >
        {/* Ambient aura (radial glow) */}
        <div
          aria-hidden
          className='pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(closest-side,rgba(0,0,0,1),transparent)]'
          style={{
            background: `radial-gradient(120px 60px at 80% -20%, rgba(80,120,255,.25), transparent), 
              radial-gradient(160px 100px at -10% 120%, rgba(0,0,0,.5), transparent)`,
            filter: 'blur(12px)',
          }}
        />

        {/* --- Conditional Content Rendering based on SWR state --- */}
        {/* Loading state with Skeleton */}
        {isLoading && (
          <div className='space-y-4'>
            <Skeleton className='h-6 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className='text-red-400'>
            <p className='font-semibold'>Error: {error.message}</p>
          </div>
        )}

        {/* Fetched data display */}
        {data && (
          <>
            {/* Size and Color Selectors */}
            <SizeSelector variants={data.data} />
            <ColorsSelector variants={data.data} />

            {/* Add to Cart and Buy Now buttons */}
            <div className='space-y-4'>
              <AddToCart
                variants={data.data}
                productMetaData={{ title: productTitle, slug: productSlug }}
              />
              <BuyNow />
            </div>
          </>
        )}
      </PopoverContent>
    ),
    [data, error, isLoading, productSlug, productTitle],
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button name={buttonProps!.name} {...buttonProps}>
          Add to Cart
        </Button>
      </PopoverTrigger>
      {popoverContent}
    </Popover>
  );
};

export default SizeAndColorSelectorPopover;
