import { type CartVariant, useCartStore } from '@/stores/shop_stores/cartStore';
import { type FC, useCallback, useState } from 'react';
import { Button, type ButtonProps } from '../../primitives/button';

export const ItemQuantityComponent: FC<{
  cartItem: CartVariant;
  className?: string;
  disableIncrement?: boolean;
}> = ({ cartItem, className, disableIncrement = false }) => {
  const { quantity, title, variantId } = cartItem;

  const addToCart = useCartStore((state) => state.addToCart);
  const reduceFromCart = useCartStore((state) => state.reduceFromCart);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeQuantity = useCallback(
    async (delta: 1 | -1) => {
      if (isSaving || (delta > 0 && disableIncrement)) return;
      setIsSaving(true);
      setError(null);
      try {
        if (delta > 0) {
          await addToCart({ ...cartItem, quantity: 1 });
        } else {
          await reduceFromCart(variantId, 1);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'We could not save this quantity.');
      } finally {
        setIsSaving(false);
      }
    },
    [addToCart, reduceFromCart, cartItem, disableIncrement, variantId, isSaving],
  );

  return (
    <div className='min-w-0 max-w-full'>
      <section
        className={`flex w-auto min-w-[6.5rem] max-w-full items-center justify-between rounded-lg border-[.5px] border-gray-300 ${className ?? ''} not-a`}
      >
        <OperationButton
          name={`Decrease quantity of ${title}`}
          disabled={isSaving}
          onClick={() => void changeQuantity(-1)}
        >
          -
        </OperationButton>
        <span className='min-w-0 px-1 text-center text-base font-bold [overflow-wrap:anywhere]'>
          {quantity}
        </span>

        <OperationButton
          name={`Increase quantity of ${title}`}
          disabled={disableIncrement || isSaving}
          onClick={() => void changeQuantity(1)}
        >
          +
        </OperationButton>
      </section>
      {error && (
        <p role='alert' className='mt-1 max-w-56 text-xs text-amber-200'>
          {error}
        </p>
      )}
    </div>
  );
};

const OperationButton: FC<ButtonProps> = ({ className, name, onClick, children, ...rest }) => {
  return (
    <Button
      className={`h-11 w-11 shrink-0 rounded-lg bg-slate-950 p-2 text-xl ${className ?? ''}`}
      name={name}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Button>
  );
};
