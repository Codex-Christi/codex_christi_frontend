'use client';

import { useAuthStore } from '@/stores/authStore';
import { authFlowUrl, getAuthRoutes, publicShopPath } from '@/lib/auth/domain-routing';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { useHasMounted } from '@/lib/hooks/useHasMounted';
import { usePublicRuntimeConfig } from '@/lib/runtime-config/hooks';

export default function CheckoutAccountPrompt({
  onSignIn,
  returnPath = '/shop/checkout',
  context = 'checkout',
}: {
  onSignIn?: () => void;
  returnPath?: string;
  context?: 'checkout' | 'order_access';
}) {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const origins = usePublicRuntimeConfig();
  const mounted = useHasMounted();
  if (authenticated) return null;
  const hostname = mounted ? window.location.hostname : 'localhost';
  const href = authFlowUrl(getAuthRoutes(hostname, true, origins).login, {
    next: publicShopPath(returnPath, hostname, origins),
  });
  return (
    <p className='mb-6 text-sm leading-6 text-white/70'>
      {context === 'order_access'
        ? 'Placed this order with an account?'
        : 'You can check out as a guest. Have an account?'}{' '}
      <CustomShopLink
        href={href}
        onClick={onSignIn}
        className='font-semibold text-white underline underline-offset-4'
      >
        Sign in
      </CustomShopLink>
    </p>
  );
}
