import React from 'react';
import Image from 'next/image';

const BluePlanet = () => {
  return (
    <Image
      priority={false}
      loading='lazy'
      alt='Blue Planet'
      height={0}
      width={0}
      src='/media/img/home/blue-planet.svg'
      className={`w-[80%] max-w-[550px] h-[8.5rem] right-[-4rem] top-[-1.25rem]
        md:w-[65%] md:max-w-[500px] md:h-[9rem] md:right-[-4.5rem]
        lg:w-[35%] lg:max-w-[470px] lg:h-[200px] lg:right-0 lg:top-[-.1rem]
        absolute z-[-1] !overflow-x-hidden `}
    />
  );
};

export default BluePlanet;
