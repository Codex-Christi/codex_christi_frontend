import { getOrderFinalDetails } from '@/actions/shop/checkout/getOrderFinalDetails';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { createContext, FC, ReactNode, useCallback, useEffect, useState } from 'react';

type ServerOrderDetailsType = Awaited<ReturnType<typeof getOrderFinalDetails>> | null;

export const ServerOrderDetailsContext = createContext<ServerOrderDetailsType | undefined>(
  undefined,
);

export const ServerOrderDetailsComponent: FC<{ children?: ReactNode }> = ({ children }) => {
  // Hooks
  const cart = useCartStore((store) => store.variants);
  const country = useShopCheckoutStore((state) => state.delivery_address.shipping_country);

  const [serverOrderDetails, setServerOrderDetails] = useState<ServerOrderDetailsType>(null);

  const serverOrderDetailsUpdaterFunc = useCallback(async () => {
    const orderDetailsFromServer = await getOrderFinalDetails(
      cart,
      country ? country : 'USA',
      'merchize',
    );
    setServerOrderDetails(orderDetailsFromServer);
  }, [cart, country]);

  // useEffect
  useEffect(() => {
    serverOrderDetailsUpdaterFunc();
  }, [serverOrderDetailsUpdaterFunc]);

  return (
    <ServerOrderDetailsContext.Provider value={serverOrderDetails}>
      {children}
    </ServerOrderDetailsContext.Provider>
  );
};
