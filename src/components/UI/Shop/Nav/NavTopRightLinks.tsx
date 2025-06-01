import { FC } from 'react';
import { SearchButtonOnly } from './NavSearch';
import { CartIcon } from './NavIcons';
import { Heart } from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import ShopUserAvatar from './ShopUserAvatar';

const NavTopRightLinks: FC = () => {
  // Hooks

  // JSX
  return (
    <section
      className={`flex items-center justify-between 
    gap-6 
    sm:gap-8
    md:gap-10
    lg:gap-12`}
    >
      <SearchButtonOnly
        name='Search Button'
        className='scale-125 relative block lg:!hidden'
        isDesktopOnly={false}
      />

      <>
        {['account-overview', 'cart', 'my-wishlist'].map((str, index) => {
          const href = '/shop/' + str;
          return (
            <CustomShopLink
              href={href}
              className='min-w-[30px]'
              key={str + index}
            >
              {str === 'cart' && <CartIcon />}
              {str === 'my-wishlist' && <Heart />}
              {str === 'account-overview' && (
                <ShopUserAvatar alt={'User avatar'} width={35} height={35} />
              )}
            </CustomShopLink>
          );
        })}
      </>
    </section>
  );
};

export default NavTopRightLinks;
