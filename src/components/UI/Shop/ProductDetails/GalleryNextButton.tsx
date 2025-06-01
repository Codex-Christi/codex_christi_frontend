import React, { FC, SetStateAction } from 'react';
import { Button } from '../../primitives/button';
import { FaAngleRight } from 'react-icons/fa6';

export const GalleryNextButton: FC<{
  setCurrentItem: (value: SetStateAction<number>) => void;
  imagesArr: string[];
}> = ({ setCurrentItem, imagesArr }) => {
  return (
    <Button
      name='gallery-next-button'
      className='absolute top-[40%] right-2 text-black bg-transparent hover:bg-transparent hover:scale-150'
      type='button'
      onClick={() => {
        setCurrentItem((prevIndex) => {
          if (prevIndex + 1 === imagesArr.length) return 0;

          return prevIndex + 1;
        });
      }}
      aria-label='Go to next image'
    >
      <FaAngleRight className='size-10' />
    </Button>
  );
};
