import { FC } from 'react';
import { SearchButtonOnly } from './NavSearch';
import { CartIcon } from './NavIcons';
import { Heart } from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import UserAvatar from './UserAvatar';

const NavTopRightLinks: FC = () => {
  // Hooks

  // JSX
  return (
    <section
      className={`flex items-center justify-between 
    gap-4 
    sm:gap-6
    md:gap-10`}
    >
      <SearchButtonOnly
        className='scale-125 relative block lg:!hidden'
        isDesktopOnly={false}
      />

      <>
        {['cart', 'favorites', 'profile'].map((str, index) => {
          const href = '/shop/' + str;
          return (
            <CustomShopLink href={href} key={str + index}>
              {str === 'cart' && <CartIcon />}
              {str === 'favorites' && <Heart />}
              {str === 'profile' && (
                <UserAvatar
                  src='https://avatar.iran.liara.run/public'
                  alt={'User avatar'}
                  width={25}
                  height={25}
                />
              )}
            </CustomShopLink>
          );
        })}
      </>
    </section>
  );
};

export default NavTopRightLinks;
