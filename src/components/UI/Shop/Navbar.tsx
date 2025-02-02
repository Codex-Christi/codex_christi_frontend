'use client';

import { FC } from 'react';
import Logo from './Logo';

const ShopNav: FC = () => {
  return (
    <nav className={`lg:p-[32px]`}>
      <Logo />
    </nav>
  );
};

export default ShopNav;
