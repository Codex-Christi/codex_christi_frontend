import { FC } from 'react';
import Logo from '../Logo';

// Main Nav Component
const MainNav: FC = () => {
  return (
    <nav
      role='navigation'
      className={`!z-[99] mt-[2.25rem] flex mx-[3.5vw] py-.5 justify-between relative 
    !bg-transparent !text-white !select-none`}
    >
      <Logo with_text />
    </nav>
  );
};

export default MainNav;
