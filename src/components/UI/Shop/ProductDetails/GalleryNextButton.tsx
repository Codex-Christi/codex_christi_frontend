import React, { FC } from 'react';
import { Button } from '../../primitives/button';
import { FaAngleRight } from 'react-icons/fa6';

export const GalleryNextButton: FC<{
  onClick?: () => void | undefined;
  className?: string;
  ariaLabel?: string;
  name?: string;
}> = ({ onClick, className, ariaLabel, name }) => {
  return (
    <Button
      name={name ?? 'gallery-next-button'}
      className={`absolute top-[45%] right-2 !text-black hover:scale-125 bg-transparent
      hover:shadow-lg hover:shadow-gray-100 rounded-[50%] !py-4 px-1 !bg-gray-50 hover:bg-white ${className ?? ''}`}
      type='button'
      onClick={onClick}
      aria-label={ariaLabel ?? 'Go to next image'}
    >
      <FaAngleRight className='size-8' />
    </Button>
  );
};
