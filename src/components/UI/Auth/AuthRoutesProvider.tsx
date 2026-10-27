'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { getAuthRoutes, type AuthRoutes } from '@/lib/auth/domain-routing';
import { safeAuthReturnPath } from '@/lib/auth/domain-routing';
import { useSearchParams } from 'next/navigation';

const RoutesContext = createContext<AuthRoutes>(getAuthRoutes('localhost'));
export const useAuthRoutes = () => useContext(RoutesContext);
export function useAuthReturnPath() {
  const routes = useAuthRoutes();
  return safeAuthReturnPath(useSearchParams().get('next'), routes);
}
export default function AuthRoutesProvider({
  routes,
  children,
}: {
  routes: AuthRoutes;
  children: ReactNode;
}) {
  return <RoutesContext.Provider value={routes}>{children}</RoutesContext.Provider>;
}
