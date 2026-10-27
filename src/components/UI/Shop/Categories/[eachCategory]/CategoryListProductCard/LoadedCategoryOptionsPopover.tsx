'use client';

import type { ReactElement, SyntheticEvent } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/primitives/popover';
import { Skeleton } from '@/components/UI/primitives/skeleton';
import ProductOptionsContent from './ProductOptionsContent';

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

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

export default function LoadedCategoryOptionsPopover({
  open,
  onOpenChange,
  trigger,
  productId,
  productTitle,
  productSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactElement;
  productId: string;
  productTitle: string;
  productSlug: string;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
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
          {open && (
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
