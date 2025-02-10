import { FC } from 'react';
import { SearchButtonOnly } from './NavSearch';
import useResponsiveSSR from '@/lib/hooks/useResponsiveSSR';
import Link from 'next/link';
import { CartIcon } from './NavIcons';

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
          const href = '/' + str;
          return (
            <Link href={href} key={str + index}>
              {str === 'cart' && <CartIcon />}
              {str === 'favorites' && 'der'}
              {str === 'profile' && 'buytr'}
            </Link>
          );
        })}
      </>
    </section>
  );
};

export default NavTopRightLinks;
