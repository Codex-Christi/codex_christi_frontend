import React, { FC, SetStateAction } from 'react';
import { Button } from '../../primitives/button';
import { FaAngleLeft } from 'react-icons/fa6';

export const GalleryPrevButton: FC<{
  setCurrentItem: (value: SetStateAction<number>) => void;
  imagesArr: string[];
}> = ({ setCurrentItem, imagesArr }) => {
  return (
    <Button
      name='gallery-prev-button'
      className='absolute top-[40%] left-2  text-black bg-transparent hover:scale-125
      shadow-lg shadow-gray-100 rounded-[50%] !py-6  px-1 bg-gray-50 hover:bg-gray-50'
      type='button'
      onClick={() => {
        setCurrentItem((prevIndex) => {
          if (prevIndex - 1 < 0) return imagesArr.length - 1;

          return prevIndex - 1;
        });
      }}
      aria-label='Go to previous image'
    >
      <FaAngleLeft className='size-10' />
    </Button>
  );
};
