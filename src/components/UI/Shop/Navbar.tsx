'use client';

import { FC } from 'react';
import Logo from './Logo';
import NavSearch from './NavSearch';

const ShopNav: FC = () => {
  return (
    <nav
      role='navigation'
      className={`!z-[99] relative pointer-events-auto bg-blue-700/30 backdrop-blur-[2px] flex
        px-[16px] py-[10px]
        md:px-[20px] md:py-[12px]
        lg:px-[24px] lg:py-[16px] `}
    >
      <Logo />
      <NavSearch />
    </nav>
  );
};

export default ShopNav;
