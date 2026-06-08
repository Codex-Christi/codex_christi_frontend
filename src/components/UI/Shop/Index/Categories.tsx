import Image from 'next/image';
import { categoriesObj } from '@/lib/utils/shopHomePageProductsData';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import GlobalProductPrice from '../GlobalShopComponents/GlobalProductPrice';
import CountryDropdownClientFloating from './CountryDropDownClientFloating';

const Categories = () => {
  const imageQuality = 50;
  const imageSizes =
    '(max-width: 640px) 80px, (max-width: 1024px) 125px, (min-width: 1280px) 120px, 160px';

  // Main JSX
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
              <h2 className='font-bold font-ocr text-white text-2xl text-center'>
                {products.headerTitle}
              </h2>

              <div className='grid gap-8 grid-cols-2 md:grid-cols-1'>
                {/* Map through  */}
                {products.content.map((product) => (
                  <div className='grid gap-4 p-4' key={product.productId}>
                    <CustomShopLink
                      className='grid gap-2 xl:gap-4'
                      href={`/shop/product/${product.productId}`}
                    >
                      <Image
                        className='mx-auto h-[250px] object-contain object-center md:h-[120px] xl:h-[150px] 2xl:h-[200px]'
                        style={{ width: 'auto' }}
                        src={`/${product.image_name}`}
                        alt={product.img_alt}
                        width={200}
                        height={200}
                        fetchPriority='auto'
                        loading='lazy'
                        quality={imageQuality}
                        sizes={imageSizes}
                      />

                      <h3 className='text-center font-bold'>
                        <GlobalProductPrice
                          usdCentsBase={product.usdCentsBase}
                          className='text-lg font-semibold'
                        />
                      </h3>
                    </CustomShopLink>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ))}
      </div>

      <CountryDropdownClientFloating initialIso3='USA' />
    </div>
  );
};

export default Categories;
