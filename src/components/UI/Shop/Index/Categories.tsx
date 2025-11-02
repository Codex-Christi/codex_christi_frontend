import Image from 'next/image';
import Link from 'next/link';
import CurrencySelector from '@/components/currecncy-selector';
import PriceDisplay from '@/components/price-display';
import { categoriesObj } from '@/lib/utils/shop_home_pics';

const Categories = () => {
  return (
    <div className='space-y-8'>
      <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-4'>
        {Object.entries(categoriesObj).map(([categoryName, products]) => (
          <div
            className='bg-[linear-gradient(161.11deg,_rgba(0,_133,_255,_0.7)_6.84%,_rgba(0,_24,_140,_0.5)_49.48%,_rgba(8,_8,_8,_0.7)_92.13%)] 
            backdrop-blur-[4px] py-8 px-4 rounded-[20px] md:px-8'
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
    </div>
  );
};

export default Categories;
