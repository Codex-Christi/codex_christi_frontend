import { getOrderFinalDetails } from '@/actions/shop/checkout/getOrderFinalDetails';
import { createContext, FC, ReactNode } from 'react';

type ServerOrderDetailsType = Awaited<ReturnType<typeof getOrderFinalDetails>> | null;

export const ServerOrderDetailsContext = createContext<ServerOrderDetailsType | undefined>(
  undefined,
);

export const ServerOrderDetailsComponent: FC<{
  children?: ReactNode;
  details: ServerOrderDetailsType;
}> = ({ children, details }) => {
  return (
    <ServerOrderDetailsContext.Provider value={details}>
      {children}
    </ServerOrderDetailsContext.Provider>
  );
};
