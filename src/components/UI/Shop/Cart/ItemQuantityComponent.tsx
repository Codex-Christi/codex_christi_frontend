import { CartVariant, useCartStore } from '@/stores/shop_stores/cartStore';
import { FC, ReactNode, useCallback } from 'react';
import { Button, ButtonProps } from '../../primitives/button';

export const ItemQuantityComponent: FC<{
  cartItem: CartVariant;
  className?: string;
}> = ({ cartItem, className }) => {
  const { quantity, title, variantId } = cartItem;

  //   Hooks
  const { addToCart, reduceFromCart } = useCartStore();

  //   Handlers
  const incrementItemQuantity = useCallback(() => {
    addToCart({ ...cartItem, quantity: 1 });
  }, [addToCart, cartItem]);

  const decrementQuantity = useCallback(() => {
    reduceFromCart(variantId, 1);
  }, [reduceFromCart, variantId]);
  //

  // JSX
  return (
    <section
      className={`flex-row items-center border-gray-300 border-[.5px]
         rounded-lg ${className} justify-between w-full max-w-[8.5rem]`}
    >
      {/* Reduce quantity */}
      <OperationButton
        name={`Remove ${title} ${variantId} from Cart`}
        // disabled={quantity <= 1}
        onClick={decrementQuantity}
      >
        -
      </OperationButton>
      {/* Quantity digit */}
      <h4 className={`text-[1.05rem] font-bold`}>{`${quantity}`}</h4>

      {/* Increment quantity */}
      <OperationButton
        name={`Add ${title} ${variantId} to Cart`}
        onClick={incrementItemQuantity}
      >
        +
      </OperationButton>
    </section>
  );
};

interface OperationButtonInterface extends ButtonProps {
  onClick?: () => void;
  clasName?: string;
  name: string;
  children: ReactNode;
}

const OperationButton: FC<OperationButtonInterface> = ({
  clasName,
  name,
  onClick,
  children,
  ...rest
}) => {
  return (
    <Button
      className={`bg-slate-950 rounded-lg text-2xl p-3 ${clasName}`}
      name={`${name}`}
      onClick={onClick}
      {...rest}
    >
      {children}
    </Button>
  );
};
