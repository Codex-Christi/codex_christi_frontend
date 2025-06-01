import Link from 'next/link';
import Image from 'next/image';
import { FC, useMemo, useState } from 'react';
import { useProductDetailsContext } from '.';
import { useCurrentVariant } from './currentVariantStore';
import { GalleryPrevButton } from './GalleryPrevButton';
import { GalleryNextButton } from './GalleryNextButton';

export const ProductImageGallery: FC = () => {
  const [currentItem, setCurrentItem] = useState(0);

  const productDetailsContext = useProductDetailsContext();
  const { currentVariant } = useCurrentVariant((state) => state);

  const metadata = productDetailsContext.productMetaData;
  const imagesArr = useMemo(
    () =>
      currentVariant.image_uris.length > 0
        ? currentVariant.image_uris
        : [metadata.image],
    [currentVariant, metadata.image]
  );

  return (
    <div className='bg-[#4C3D3D3D] backdrop-blur-[20px] p-4 rounded-[20px] space-y-2 lg:p-8 flex flex-col gap-8 items-start md:gap-12 md:flex-row'>
      {/* Thumbnail Image Section*/}

      <div className='grid gap-4 grid-cols-2 md:grid-cols-1 order-2 md:order-1'>
        {imagesArr &&
          imagesArr.map((image, index) => (
            <div
              className={`rounded-[20px] size-20 border-2 cursor-pointer ${index === currentItem ? 'border-white' : 'border-transparent'}`}
              key={index}
              onClick={() => setCurrentItem(index)}
            >
              <Image
                className='rounded-[20px]'
                src={image}
                width={80}
                height={80}
                alt='Dummy product name'
                quality={100}
              />
            </div>
          ))}
      </div>
      {/* Main Image Section */}
      <div className='flex items-start md:w-full h-full gap-8 md:order-2'>
        <div className='rounded-[20px] w-[90%] h-56 md:h-full relative'>
          {imagesArr[currentItem] && (
            <Image
              className='rounded-[20px] size-full object-cover object-top aspect-[16/13]'
              width={512}
              height={288}
              src={imagesArr[currentItem]}
              alt='Dummy product name'
              quality={100}
            />
          )}

          {/* Navigation Buttons */}
          {imagesArr.length > 1 && (
            <>
              <GalleryPrevButton
                setCurrentItem={setCurrentItem}
                imagesArr={imagesArr}
              />
              <GalleryNextButton
                setCurrentItem={setCurrentItem}
                imagesArr={imagesArr}
              />
            </>
          )}
        </div>

        <div className='grid gap-8'>
          <Link href=''>
            <svg width='26' height='26' viewBox='0 0 26 26' fill='none'>
              <path
                d='M24.5801 1.03334C24.5272 1.01147 24.4711 1 24.4147 1H15.513C15.2736 1 15.0798 1.19375 15.0798 1.43318C15.0798 1.67261 15.2736 1.86636 15.513 1.86636H23.369L14.8378 10.3975C14.6686 10.5667 14.6686 10.8408 14.8378 11.0101C14.9225 11.0947 15.0333 11.137 15.1441 11.137C15.2549 11.137 15.3658 11.0947 15.4504 11.0101L23.9815 2.4789V10.1649C23.9815 10.4043 24.1753 10.598 24.4147 10.598C24.6542 10.598 24.8479 10.4043 24.8479 10.1649V1.43318C24.8479 1.37684 24.8364 1.32068 24.8146 1.2678C24.7707 1.16165 24.6863 1.07723 24.5801 1.03334Z'
                fill='white'
                stroke='white'
              />
              <path
                d='M1.28083 15.6287C1.0414 15.6287 0.847656 15.8224 0.847656 16.0618V24.5668C0.847656 24.6231 0.859131 24.6793 0.881022 24.7322C0.924885 24.8383 1.00933 24.9227 1.11538 24.9666C1.16831 24.9885 1.22447 24.9999 1.28083 24.9999H10.2393C10.4787 24.9999 10.6724 24.8062 10.6724 24.5668C10.6724 24.3273 10.4787 24.1336 10.2393 24.1336H2.32655L10.9427 15.5174C11.112 15.3482 11.112 15.0741 10.9427 14.9049C10.7735 14.7357 10.4994 14.7357 10.3302 14.9049L1.71401 23.521V16.0618C1.71401 15.8224 1.52027 15.6287 1.28083 15.6287Z'
                fill='white'
                stroke='white'
              />
            </svg>
          </Link>

          <Link href=''>
            <svg width='30' height='26' viewBox='0 0 30 26' fill='none'>
              <path
                d='M15.8468 24.41C15.4671 24.7464 14.8958 24.7453 14.5175 24.4075L13.2477 23.2736C6.38099 17.1657 1.84766 13.1373 1.84766 8.19346C1.84766 4.16512 5.07432 1 9.18099 1C11.1006 1 12.9564 1.72531 14.363 2.92401C14.8259 3.31848 15.5361 3.31848 15.999 2.92402C17.4056 1.72531 19.2614 1 21.181 1C25.2877 1 28.5143 4.16512 28.5143 8.19346C28.5143 13.1373 23.981 17.1657 17.1143 23.2866L15.8468 24.41Z'
                stroke='white'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </Link>

          <Link href=''>
            <svg width='22' height='26' viewBox='0 0 22 26' fill='none'>
              <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M20.6682 21.9967C20.6147 20.4055 19.295 19.1537 17.7084 19.1896C16.1218 19.2253 14.8593 20.5351 14.8771 22.1271C14.8951 23.7189 16.1866 25.0001 17.7735 25.0001C19.3993 24.9717 20.6949 23.6276 20.6682 21.9967Z'
                stroke='white'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M10.5341 12.9862C10.574 15.4334 8.62967 17.45 6.19032 17.4913C3.75163 17.4491 1.80825 15.4327 1.84826 12.9862C1.80825 10.5399 3.75163 8.52351 6.19032 8.4812C8.62967 8.52256 10.574 10.5392 10.5341 12.9862Z'
                stroke='white'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M19.2197 3.97618C19.2452 5.03077 18.6989 6.01641 17.7925 6.55124C16.8862 7.08607 15.762 7.08607 14.8556 6.55124C13.9492 6.01641 13.4029 5.03077 13.4286 3.97618C13.4029 2.92159 13.9492 1.93597 14.8556 1.40112C15.762 0.866293 16.8862 0.866293 17.7925 1.40112C18.6989 1.93597 19.2452 2.92159 19.2197 3.97618Z'
                stroke='white'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <line
                x1='9.14055'
                y1='9.79228'
                x2='13.6136'
                y2='5.31922'
                stroke='white'
                strokeWidth='2'
              />
              <path
                d='M9.80273 15.4656L15.5117 20.2808'
                stroke='white'
                strokeWidth='2'
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
};
