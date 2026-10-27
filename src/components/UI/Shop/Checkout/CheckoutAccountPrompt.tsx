'use client';

import { useAuthStore } from '@/stores/authStore';
import { authFlowUrl, getAuthRoutes, publicShopPath } from '@/lib/auth/domain-routing';
import CustomShopLink from '../HelperComponents/CustomShopLink';

export default function CheckoutAccountPrompt({
  onSignIn,
  returnPath = '/shop/checkout',
}: {
  onSignIn?: () => void;
  returnPath?: string;
}) {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  if (authenticated) return null;
  const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  const href = authFlowUrl(getAuthRoutes(hostname, true).login, {
    next: publicShopPath(returnPath, hostname),
  });
  return (
    <p className='mb-6 text-sm leading-6 text-white/70'>
      You can check out as a guest. Have an account?{' '}
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
