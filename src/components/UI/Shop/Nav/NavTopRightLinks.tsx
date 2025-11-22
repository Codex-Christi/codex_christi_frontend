import { FC } from 'react';
import { SearchButtonOnly } from './NavSearch';
import { CartIcon } from './NavIcons';
import { Heart } from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import ShopUserAvatar from './ShopUserAvatar';
import { getDefaultISO3 } from '@/lib/utils/shop/geo/getDefaultISO3.client';
import dynamic from 'next/dynamic';
import { useAmIOnShopRoute } from '@/lib/hooks/shopHooks/useAmIOnShopRoute';
const CountryDropdown = dynamic(
  () => import('@/components/UI/Shop/Index/CountryDropDownClientFloating'),
);

const NavTopRightLinks: FC = () => {
  const defaultISO3 = getDefaultISO3();
  const { youAreOnDesiredShopRoute: amIOnShopHome } = useAmIOnShopRoute('/');

  // JSX
  return (
    <section className={`flex items-center justify-between gap-6 sm:gap-8 md:gap-10 lg:gap-12`}>
      {!amIOnShopHome && (
        <CountryDropdown
          initialIso3={defaultISO3}
          slim
          chevronClassName='ml-2 shrink-0 opacity-100 size-[1.5rem] text-white' // wrapper-only bump
          classNames={{
            trigger: ` hidden md:inline-flex items-center gap-2 h-9 px-3 rounded-full border border-white/20 bg-black/60 text-white whitespace-nowrap 
            hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`,
          }}
        />
      )}

      <SearchButtonOnly
        name='Search Button'
        className='scale-125 relative block lg:!hidden'
        isDesktopOnly={false}
      />

      <>
        {['account-overview', 'cart', 'my-wishlist'].map((str, index) => {
          const href = '/shop/' + str;
          return (
            <CustomShopLink href={href} className='min-w-[30px]' key={str + index}>
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
