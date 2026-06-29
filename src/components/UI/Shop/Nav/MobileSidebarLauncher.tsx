'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '../../primitives/button';

const ShopMobileSideBar = dynamic(() => import('../MobileSidebar'), { ssr: false });

export default function MobileSidebarLauncher() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
      <Button
        name='Toggle mobile sidebar'
        className='scale-75 !p-0 md:scale-90 lg:!hidden'
        variant='link'
        onClick={() => setIsSidebarOpen((prevState) => !prevState)}
      >
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='40'
          height='24.516'
          fill='none'
          viewBox='0 0 40 24.516'
          aria-hidden='true'
        >
          <path
            id='Vector'
            fill='#FFF'
            fillRule='evenodd'
            d='M1.935 0a1.935 1.935 0 0 0 0 3.871h36.13a1.936 1.936 0 0 0 0-3.871zm0 10.323a1.936 1.936 0 0 0 0 3.87h30.968a1.935 1.935 0 1 0 0-3.87zm0 10.322a1.935 1.935 0 1 0 0 3.871H20a1.936 1.936 0 0 0 0-3.87z'
          />
        </svg>
      </Button>

      {isSidebarOpen && (
        <ShopMobileSideBar openState={isSidebarOpen} openCloseController={setIsSidebarOpen} />
      )}
    </>
  );
}
