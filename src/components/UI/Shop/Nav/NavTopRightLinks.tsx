import { FC } from 'react';
import { SearchButtonOnly } from './NavSearch';
import useResponsiveSSR from '@/lib/hooks/useResponsiveSSR';
import { CartIcon } from './NavIcons';
import { Heart } from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';

const NavTopRightLinks: FC = () => {
  // Hooks
  const { isDesktopOnly } = useResponsiveSSR();

  // JSX
  return (
    <section
      className={`flex items-center justify-between 
    gap-4 
    sm:gap-6
    md:gap-10`}
    >
      {!isDesktopOnly && (
        <SearchButtonOnly
          className='scale-125 relative block'
          isDesktopOnly={false}
        />
      )}
      <>
        {['cart', 'favorites', 'profile'].map((str, index) => {
          const href = '/shop/' + str;
          return (
            <CustomShopLink href={href} key={str + index}>
              {str === 'cart' && <CartIcon />}
              {str === 'favorites' && <Heart />}
              {str === 'profile' && 'User'}
            </CustomShopLink>
          );
        })}
      </>
    </section>
  );
};

export default NavTopRightLinks;
