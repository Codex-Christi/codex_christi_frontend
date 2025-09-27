'use client';

import { FC, ComponentProps } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/UI/primitives/popover';
import { Button } from '@/components/UI/primitives/button';
import { AddToCart } from '../../../ProductDetails/AddToCart';
import { BuyNow } from '../../../ProductDetails/BuyNow';
import SizeSelector from '../../../ProductDetails/SizeSelector';
import ColorsSelector from '../../../ProductDetails/ColorsSelector';

interface SizeAndColorSelectorPopoverProps {
  // Pass the props for the button, not the button element itself
  buttonProps?: ComponentProps<typeof Button>;
}

const SizeAndColorSelectorPopover: FC<SizeAndColorSelectorPopoverProps> = ({ buttonProps }) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button name={buttonProps!.name} {...buttonProps}>
          Add to Cart
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        side='top'
        sideOffset={8}
        className={`bg-black/35 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-white/10 rounded-2xl p-4 shadow-2xl
             shadow-black/40 z-[60] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 
             text-white select-none cursor-pointer`}
      >
        {/* Ambient aura (radial glow) */}
        <div
          aria-hidden
          className=' pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(closest-side,rgba(0,0,0,1),transparent)]'
          style={{
            background: `radial-gradient(120px 60px at 80% -20%, rgba(80,120,255,.25), transparent), 
              radial-gradient(160px 100px at -10% 120%, rgba(0,0,0,.5), transparent)`,
            filter: 'blur(12px)',
          }}
        />
        {/* …your content… */}
        SizeAndColorSelectorPopover
        {/* Size and Color Selectors */}
        <SizeSelector />
        <ColorsSelector />
        {/* Add to Cart and Buy Now buttons */}
        <div className='space-y-4'>
          <AddToCart />

          <BuyNow />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SizeAndColorSelectorPopover;
