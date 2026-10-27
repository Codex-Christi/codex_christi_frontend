import { type CartVariant, useCartStore } from '@/stores/shop_stores/cartStore';
import { type FC, useState } from 'react';
import Image from 'next/image';
import SizeAndColorElem from './SizeAndColor';
import { ItemQuantityComponent } from './ItemQuantityComponent';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import { Button } from '@/components/UI/primitives/button';
import { Trash2 } from 'lucide-react';
import GlobalProductPrice from '../GlobalShopComponents/GlobalProductPrice';
import { formatOrderMoney, type OrderPreviewTotals } from '@/lib/shop/checkout/orderMoney';
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
import { getCartItemAvailability, type CartItemAvailabilityMap } from './cartAvailability';

const CartItems: FC<{
  cartItems: CartVariant[];
  availabilityByVariantId: CartItemAvailabilityMap;
  prices?: OrderPreviewTotals | null;
}> = ({ cartItems, availabilityByVariantId, prices }) => {
  const removeFromCart = useCartStore((state) => state.removeFromCart);

  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const handleConfirmRemove = async () => {
    if (!pendingRemoveId) return;
    const id = pendingRemoveId;
    setPendingRemoveId(null);
    setRemovingId(id);
    setRemoveError(null);
    try {
      await removeFromCart(id);
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : 'We could not remove this item.');
    } finally {
      setRemovingId(null);
    }
  };

  const renderRemoveButton = (variantId: string) => (
    <Button
      type='button'
      variant='outline'
      size='sm'
      aria-label='Remove item from cart'
      title='Remove item from cart'
      name='Remove item from cart'
      disabled={removingId === variantId}
      className='flex min-h-11 shrink-0 items-center gap-1 border-red-400 bg-transparent px-3 font-semibold text-red-400 hover:bg-destructive/30 hover:text-red-200'
      onClick={() => setPendingRemoveId(variantId)}
    >
      <Trash2 className='h-4 w-4' />
      <span>Remove</span>
    </Button>
  );

  return (
    <>
      {removeError && (
        <p role='alert' className='text-sm text-amber-200'>
          {removeError}
        </p>
      )}
      {cartItems.map((cartItem) => {
        const { itemDetail: variant, title, quantity } = cartItem;
        const { retail_price, options, product: parentID } = variant;
        const image = variant.image || variant.image_uris?.[0];
        const availability = getCartItemAvailability(availabilityByVariantId, cartItem.variantId);
        const isUnavailable = availability.status === 'unavailable';
        const isUnverified = availability.status === 'unverified';
        const isChecking = availability.status === 'checking';
        const productLookupKey = parentID || cartItem.slug;
        const productHref = `/shop/product/${encodeURIComponent(productLookupKey)}`;

        const linePrice = prices?.linePricesByVariantId[cartItem.variantId];
        const lineTotal = linePrice ? (
          formatOrderMoney(linePrice.lineTotalNum, prices!.currency)
        ) : (
          <GlobalProductPrice usdAmount={retail_price * quantity} />
        );

        return (
          <div
            key={cartItem.variantId}
            className={`my-3 grid w-full min-w-0 max-w-full select-none grid-cols-[76px_minmax(0,1fr)] gap-x-3 gap-y-4 bg-transparent sm:grid-cols-[90px_minmax(0,1fr)] sm:gap-x-4
            ${isUnavailable || isUnverified ? 'rounded-xl border border-amber-300/40 py-3' : ''}`}
          >
            {image ? (
              <CustomShopLink href={productHref} className='min-w-0 self-start'>
                <Image
                  src={image}
                  className='aspect-square h-auto w-full rounded-xl object-cover object-top hover:cursor-pointer'
                  width={90}
                  height={90}
                  alt={title}
                />
              </CustomShopLink>
            ) : (
              <div aria-hidden='true' className='aspect-square rounded-xl bg-white/5' />
            )}

            <section className='flex min-w-0 flex-col justify-between gap-2 text-left [overflow-wrap:anywhere]'>
              <CustomShopLink href={productHref}>
                <h3 className='min-w-0 text-base font-semibold leading-snug underline-offset-4 hover:underline sm:text-lg'>
                  {title}
                </h3>
              </CustomShopLink>

              {isUnavailable && (
                <div role='status' className='mt-2 space-y-1 text-sm'>
                  <p className='font-bold text-amber-200'>No longer available</p>
                  <CustomShopLink
                    href={productHref}
                    className='inline-flex font-semibold text-blue-200 underline underline-offset-2'
                  >
                    Choose another available option
                  </CustomShopLink>
                </div>
              )}

              {isUnverified && (
                <p role='status' className='mt-2 text-sm font-semibold text-amber-200'>
                  Availability could not be verified. Please refresh before checkout.
                </p>
              )}

              {isChecking && (
                <p role='status' className='mt-2 text-sm text-white/70'>
                  Checking availability…
                </p>
              )}

              <h4 className='min-w-0 text-sm text-white sm:text-base'>
                Price:{' '}
                {linePrice ? (
                  formatOrderMoney(linePrice.unitPriceNum, prices!.currency)
                ) : (
                  <GlobalProductPrice usdAmount={retail_price} />
                )}{' '}
                (each)
              </h4>
            </section>

            <div className='col-span-2 flex min-w-0 max-w-full flex-wrap items-end justify-between gap-3'>
              <SizeAndColorElem
                options={options}
                className='min-w-0 max-w-full text-sm [overflow-wrap:anywhere]'
              />
              <div className='ml-auto flex min-w-0 max-w-full flex-col items-end gap-2'>
                <div className='flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2'>
                  <ItemQuantityComponent
                    className='flex'
                    cartItem={cartItem}
                    disableIncrement={isUnavailable}
                  />
                  {renderRemoveButton(cartItem.variantId)}
                </div>
                <p className='max-w-full text-right text-base font-semibold [overflow-wrap:anywhere]'>
                  Total: {lineTotal}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      <AlertDialog
        open={pendingRemoveId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoveId(null);
        }}
      >
        <AlertDialogContent className='bg-black/70 backdrop-blur-xl backdrop-saturate-150 border border-white/10 text-white shadow-2xl shadow-black/70 rounded-2xl max-w-md w-[90vw]'>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove item?</AlertDialogTitle>
            <AlertDialogDescription className='text-gray-200'>
              This will remove the selected item from your cart. You can always add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='border border-white/25 bg-transparent text-white/80 hover:bg-white/5 hover:text-white rounded-lg px-4'>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className='border border-red-400 bg-transparent text-red-400 hover:bg-red-500/15 hover:text-red-200 rounded-lg px-4 font-semibold'
              onClick={() => void handleConfirmRemove()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CartItems;
