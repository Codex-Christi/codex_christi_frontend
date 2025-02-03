'use client';

import { FC } from 'react';
import Logo from './Logo';

const ShopNav: FC = () => {
  return (
    <nav
      className={`lg:p-[24px] !z-[99] relative pointer-events-auto bg-blue-600/30 backdrop-blur-[2px]`}
    >
      <Logo />
    </nav>
  );
};

export default ShopNav;
