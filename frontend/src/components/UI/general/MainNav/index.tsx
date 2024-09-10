import { FC } from 'react';
import Logo from '../Logo';
import NavList from './NavList';

// Main Nav Component
const MainNav: FC = () => {
  return (
    <nav
      role='navigation'
      className={`!z-[99] mt-[2.25rem] flex mx-[3.5vw] py-.5  !px-0 justify-between items-center relative 
    !bg-transparent !text-white !select-none`}
    >
      <Logo with_text />
      {/* Mobile Hamburger */}
      <svg
        className='md:!hidden'
        xmlns='http://www.w3.org/2000/svg'
        width='40'
        height='24.516'
        viewBox='2422 -423.383 40 24.516'
        style={{ WebkitPrintColorAdjust: 'exact' }}
        fill='none'
        version='1.1'
      >
        <g data-testid='Vector-502' opacity='1'>
          <path
            fill='#fff'
            d='M2460.065-423.383a1.936 1.936 0 010 3.871v-3.871zm-36.13 3.871a1.935 1.935 0 010-3.871v3.871zm36.13 6.452a1.935 1.935 0 010 3.871v-3.871zm-30.968 3.871a1.936 1.936 0 010-3.871v3.871zm30.968 6.451a1.936 1.936 0 010 3.871v-3.871zM2442-398.867a1.935 1.935 0 110-3.871v3.871zm18.065-20.645h-36.13v-3.871h36.13v3.871zm0 10.323h-30.968v-3.871h30.968v3.871zm0 10.322H2442v-3.871h18.065v3.871z'
            className='0'
          ></path>
        </g>
      </svg>
      {/*  */}
      <NavList />
    </nav>
  );
};

export default MainNav;
