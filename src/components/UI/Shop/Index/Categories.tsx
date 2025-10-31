import Image from 'next/image';
import Link from 'next/link';
import Bag from '@/assets/img/bag.png';
import BookHeap from '@/assets/img/book-heap.png';
import Book from '@/assets/img/book.png';
import SpecialsHoodie from '@/assets/img/specials-hoodie.png';
import SpecialsTshirt from '@/assets/img/specials-t-shirt.png';
import CurrencySelector from "@/components/currecncy-selector";
import PriceDisplay from "@/components/price-display";
import { categoriesObj } from '@/lib/utils/shop_home_pics';

const Categories = () => {
  return (
    <div className='space-y-8'>
      <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-4'>
        {Object.entries(categoriesObj).map(([categoryName, products]) => (
          <div
            className='bg-[linear-gradient(161.11deg,_rgba(0,_133,_255,_0.7)_6.84%,_rgba(0,_24,_140,_0.5)_49.48%,_rgba(8,_8,_8,_0.7)_92.13%)] py-8 px-4 rounded-[20px] md:px-8'
            key={categoryName}
          >
            <section className='grid gap-4'>
              <h2 className='font-extrabold text-white text-2xl text-center'>
                {products.headerTitle}
              </h2>

              <div className='grid gap-8 grid-cols-2 md:grid-cols-1'>
                {products.content.map((product) => (
                  <div className='grid gap-4 p-4' key={product.productId}>
                    <Link
                      className='grid gap-2 xl:gap-4'
                      href={`/shop/product/${product.productId}`}
                    >
                      <Image
                        className='w-full h-[250px] object-cover object-center md:h-[120px] xl:h-[150px] 2xl:h-[200px]'
                        src={`/${product.image_name}`}
                        alt={product.img_alt}
                        width={200}
                        height={200}
                        quality={100}
                      />

                        <PriceDisplay />
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ))}
      </div>

      <CurrencySelector />

      <div className='grid gap-4 md:gap-8 md:grid-cols-2 hidden'>
        <div className='bg-[linear-gradient(129.23deg,_rgba(0,_133,_255,_0.7)_15.65%,_rgba(0,_24,_140,_0.5)_51.1%,_rgba(8,_8,_8,_0.7)_86.55%)] p-4 md:p-8 rounded-[20px] grid items-center gap-4 md:grid-cols-12'>
          <p className='font-extrabold text-2xl md:col-span-4'>Back to School supplies</p>

          <div className='flex items-center gap-4 md:col-span-8'>
            <div>
              <Image className='mx-auto' src={Bag} alt='Bag' />

              <p className='font-bold text-center'>N7,999</p>
            </div>

            <div>
              <Image className='mx-auto' src={BookHeap} alt='BookHeap' />

              <p className='font-bold text-center'>N7,999</p>
            </div>

            <div>
              <Image className='mx-auto' src={Book} alt='Book' />

              <p className='font-bold text-center'>N7,999</p>
            </div>
          </div>
        </div>

        <div className='bg-[linear-gradient(129.23deg,_rgba(0,_133,_255,_0.7)_15.65%,_rgba(0,_24,_140,_0.5)_51.1%,_rgba(8,_8,_8,_0.7)_86.55%)] p-4 md:p-8 rounded-[20px] grid items-center gap-4 md:grid-cols-12'>
          <p className='font-extrabold text-2xl md:col-span-4'>
            <span className='flex items-center gap-2 mb-2'>
              {Array.from({ length: 3 }).map((_, index) => (
                <svg key={index} width='25' height='24' viewBox='0 0 25 24' fill='none'>
                  <path
                    d='M12.6543 0.188232L16.3223 7.75623L24.6543 8.90723L18.5903 14.7352L20.0703 23.0142L12.6543 19.0472L5.2373 23.0142L6.7183 14.7352L0.654297 8.90723L8.9863 7.75623L12.6543 0.188232Z'
                    fill='white'
                  />
                </svg>
              ))}
            </span>
            TODAY’S SPECIALS (3)
          </p>

          <div className='flex items-center justify-between gap-4 md:col-span-8'>
            <div>
              <Image className='mx-auto' src={SpecialsHoodie} alt='Bag' />

              <p className='font-bold text-center'>N7,999</p>
            </div>

            <div>
              <Image className='mx-auto' src={SpecialsTshirt} alt='BookHeap' />

              <p className='font-bold text-center'>N7,999</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Categories;
