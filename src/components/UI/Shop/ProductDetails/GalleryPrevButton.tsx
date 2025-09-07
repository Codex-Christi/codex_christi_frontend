import React, { FC } from 'react';
import { Button } from '../../primitives/button';
import { FaAngleLeft } from 'react-icons/fa6';

export const GalleryPrevButton: FC<{
  onClick?: () => void | undefined;
  className?: string;
}> = ({ onClick, className }) => {
  return (
    <Button
      name='gallery-prev-button'
      className={`absolute top-[45%] left-2  !text-black bg-transparent hover:scale-125
      hover:shadow-lg hover:shadow-gray-100 rounded-[50%] !py-4  px-1 !bg-gray-50 hover:bg-white ${className ?? ''}`}
      type='button'
      onClick={onClick}
      aria-label='Go to previous image'
    >
      <FaAngleLeft className='size-8' />
    </Button>
  );
};
