'use client';

import type { FC } from 'react';
import { CartIcon } from './NavIcons';
import { Heart, Search } from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import ShopProfileAvatar from './ShopProfileAvatar';
import { useAmIOnShopRoute } from '@/lib/hooks/shopHooks/useAmIOnShopRoute';
import DeferredNavCountryDropdown from './DeferredNavCountryDropdown';
import { useCartStore } from '@/stores/shop_stores/cartStore';

const NavTopRightLinks: FC = () => {
  const { youAreOnDesiredShopRoute: amIOnShopHome } = useAmIOnShopRoute('/');
  const cartReviewCount = useCartStore((state) => state.conflicts.length);

  return (
    <section className='flex min-w-0 items-center justify-between gap-3 min-[400px]:gap-6 sm:gap-8 md:gap-10 lg:gap-12'>
      <DeferredNavCountryDropdown disabled={amIOnShopHome} />

      <CustomShopLink
        href='/shop/search'
        ariaLabel='Search products'
        prefetch={false}
        className='block lg:!hidden'
      >
        <Search size={24} />
      </CustomShopLink>

      {['account-overview', 'cart', 'my-wishlist'].map((str) => {
        const href = '/shop/' + str;
        return (
          <CustomShopLink
            href={href}
            ariaLabel={
              str === 'my-wishlist'
                ? 'Wishlist'
                : str === 'cart'
                  ? cartReviewCount
                    ? `Cart: ${cartReviewCount} ${cartReviewCount === 1 ? 'item needs' : 'items need'} review`
                    : 'Cart'
                  : 'Account overview'
            }
            prefetch={false}
            className='min-w-[30px]'
            key={str}
          >
            {str === 'cart' && <CartIcon />}
            {str === 'my-wishlist' && <Heart />}
            {str === 'account-overview' && (
              <ShopProfileAvatar alt='User avatar' width={35} height={35} />
            )}
          </CustomShopLink>
        );
      })}
    </section>
  );
};

export default NavTopRightLinks;
