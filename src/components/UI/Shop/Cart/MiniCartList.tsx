'use client';

import { FC, ReactNode, useMemo, useState } from 'react';
import Image from 'next/image';
import GlobalProductPrice from '../GlobalShopComponents/GlobalProductPrice';
import { ItemQuantityComponent } from './ItemQuantityComponent';
import { CartVariant, useCartStore } from '@/stores/shop_stores/cartStore';
import { buildOptionSummary, toCartOptions } from './cartOptionHelpers';
import { Trash2Icon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/primitives/alert-dialog';

type MiniCartListProps = {
  items: CartVariant[];
  showQuantityControls?: boolean;
  showRemoveButton?: boolean;
  onRemove?: (variantId: string) => void;
  className?: string;
  emptyState?: ReactNode;
  variant?: 'default' | 'compact';
  confirmBeforeRemove?: boolean;
};

export const MiniCartList: FC<MiniCartListProps> = ({
  items,
  showQuantityControls = true,
  showRemoveButton = true,
  onRemove,
  className,
  emptyState = <p className='text-sm text-white/60 pt-2'>Your cart is empty.</p>,
  variant = 'compact',
  confirmBeforeRemove = false,
}) => {
  const defaultRemove = useCartStore((state) => state.removeFromCart);
  const remove = onRemove ?? defaultRemove;
  const isCompact = variant === 'compact';
  const [pendingRemoval, setPendingRemoval] = useState<CartVariant | null>(null);

  const confirmRemove = () => {
    if (!pendingRemoval) return;
    remove(pendingRemoval.variantId);
    setPendingRemoval(null);
  };

  const cancelRemove = () => setPendingRemoval(null);

  const entries = useMemo(() => {
    const requestRemove = (item: CartVariant) => {
      if (confirmBeforeRemove) {
        setPendingRemoval(item);
        return;
      }
      remove(item.variantId);
    };

    return items.map((cartItem) => {
      const { itemDetail, quantity, variantId, title } = cartItem;
      const { retail_price, options, image } = itemDetail;
      const optionArray = toCartOptions(options);
      const { summary } = buildOptionSummary(optionArray);

      const lineTotal = retail_price * quantity;
      const fallbackInitials = (title || 'Item').slice(0, 2).toUpperCase();
      const imageSize = isCompact ? 48 : 60;
      const cardPadding = isCompact ? 'px-2 py-3' : 'px-3 py-4';
      const optionTextClass = isCompact ? 'text-[0.65rem]' : 'text-xs';
      const titleClass = isCompact ? 'text-sm' : 'text-base';
      const priceClass = isCompact ? 'text-sm' : 'text-base';
      const qtyTextClass = isCompact ? 'text-[0.65rem]' : 'text-xs';
      return (
        <div
          key={variantId}
          className={`rounded-2xl border border-white/10 bg-black/10 ${cardPadding} space-y-3`}
        >
          <div className='flex items-start gap-3'>
            {image ? (
              <Image
                src={image}
                alt={title}
                width={imageSize}
                height={imageSize}
                className={`rounded-xl object-cover object-center border border-white/10 ${
                  isCompact ? 'h-12 w-12' : 'h-[60px] w-[60px]'
                }`}
              />
            ) : (
              <div
                className={`rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-sm font-semibold text-white/70 ${
                  isCompact ? 'h-12 w-12' : 'h-[60px] w-[60px]'
                }`}
              >
                {fallbackInitials}
              </div>
            )}

            <div className='flex-1 min-w-0 text-[#F3F3F3] space-y-1'>
              <div className='flex items-start justify-between gap-2'>
                <p className={`font-semibold truncate ${titleClass}`}>{title}</p>
                {showRemoveButton && (
                  <button
                    type='button'
                    aria-label={`Remove ${title}`}
                    onClick={() => requestRemove(cartItem)}
                    className='text-red-500 hover:text-red-300 text-lg transition font-semibold leading-none'
                  >
                    <Trash2Icon className='h-4 w-4' />
                  </button>
                )}
              </div>
              {summary && <p className={`${optionTextClass} text-white/70`}>{summary}</p>}
            </div>

            <div className={`text-right font-semibold text-white ${priceClass}`}>
              <GlobalProductPrice usdAmount={lineTotal} />
              <p className={`${qtyTextClass} text-white/60`}>Qty: {quantity}</p>
            </div>
          </div>

          {showQuantityControls && (
            <div className='flex flex-wrap items-center gap-3 justify-end'>
              <ItemQuantityComponent className='flex w-auto' cartItem={cartItem} />
            </div>
          )}
        </div>
      );
    });
  }, [items, isCompact, showRemoveButton, showQuantityControls, confirmBeforeRemove, remove]);

  if (!items.length) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <>
      <div className={`space-y-4 ${className ?? ''}`}>{entries}</div>
      <AlertDialog open={pendingRemoval !== null} onOpenChange={(open) => !open && cancelRemove()}>
        <AlertDialogContent className='bg-black/70 backdrop-blur-xl backdrop-saturate-150 border border-white/10 text-white shadow-2xl shadow-black/70 rounded-2xl max-w-md w-[90vw]'>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove item?</AlertDialogTitle>
            <AlertDialogDescription className='text-gray-200'>
              {`Are you sure you want to remove "${pendingRemoval?.title}" from checkout?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='border border-white/25 bg-transparent text-white/80 hover:bg-white/5 hover:text-white rounded-lg px-4'>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className='border border-red-400 bg-transparent text-red-400 hover:bg-red-500/15 hover:text-red-200 rounded-lg px-4 font-semibold'
              onClick={confirmRemove}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
