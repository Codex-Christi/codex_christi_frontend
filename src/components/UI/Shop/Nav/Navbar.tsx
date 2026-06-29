import { FC } from 'react';
import Logo from '../Logo';
import NavSearch from './NavSearch';
import NavTopRightLinks from './NavTopRightLinks';
import SubNav from '../ShopSubNav';
import MobileSidebarLauncher from './MobileSidebarLauncher';

const ShopNav: FC = () => {
  // Main JSX
  return (
    <>
      <nav
        role='navigation'
        className={`!z-[99] relative pointer-events-auto bg-black
		flex justify-between items-center select-none
		px-2 py-[10px]
        md:px-[20px] md:py-[12px]
        lg:px-[24px] lg:py-[16px] `}
      >
        <section className='flex gap-5 md:gap-10'>
          {/* Button for Mobile Sidebar Hamburger */}
          <MobileSidebarLauncher />

          {/* Main Shop site logo */}
          <Logo />
        </section>

        <NavSearch />

        <NavTopRightLinks />
      </nav>

      <div className='hidden lg:block'>
        <SubNav />
      </div>
    </>
  );
};

export default ShopNav;
