import React from 'react';
import Image from 'next/image';

const TopHomeBanner = () => {
  return (
    <div className='w-full max-w-full relative !overflow-x-hidden'>
      <Image
        priority
        width={1500}
        height={100}
        className={`!max-w-[107vw] lg:!w-[120vw]`}
        src='/media/img/shop/ShopHome/TopHomeBanner.png'
        alt='Top Home Banner'
      />
    </div>
  );
};

export default TopHomeBanner;
