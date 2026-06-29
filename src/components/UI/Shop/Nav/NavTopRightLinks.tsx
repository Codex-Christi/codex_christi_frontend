'use client';

import { FC } from 'react';
import { SearchButtonOnly } from './NavSearch';
import { CartIcon } from './NavIcons';
import { Heart } from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import ShopProfileAvatar from './ShopProfileAvatar';
import { useAmIOnShopRoute } from '@/lib/hooks/shopHooks/useAmIOnShopRoute';
import DeferredNavCountryDropdown from './DeferredNavCountryDropdown';

const NavTopRightLinks: FC = () => {
  const { youAreOnDesiredShopRoute: amIOnShopHome } = useAmIOnShopRoute('/');

  // JSX
  return (
    <section className={`flex items-center justify-between gap-6 sm:gap-8 md:gap-10 lg:gap-12`}>
      <DeferredNavCountryDropdown disabled={amIOnShopHome} />

      <SearchButtonOnly
        name='Search Button'
        type='button'
        className='scale-125 relative block lg:!hidden'
      />

      <>
        {['account-overview', 'cart', 'my-wishlist'].map((str, index) => {
          const href = '/shop/' + str;
          return (
            <CustomShopLink
              href={href}
              prefetch={false}
              className='min-w-[30px]'
              key={str + index}
            >
              {str === 'cart' && <CartIcon />}
              {str === 'my-wishlist' && <Heart />}
              {str === 'account-overview' && (
                <ShopProfileAvatar alt='User avatar' width={35} height={35} />
              )}
            </CustomShopLink>
          );
        })}
      </>
    </section>
  );
};

export default NavTopRightLinks;
