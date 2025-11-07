import Image from 'next/image';
import { categoriesObj } from '@/lib/utils/shopHomePageProductsData';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { formatServerPriceForId } from '@/lib/utils/shop/globalFXProductPrice/server/formatServerPrice';
import GlobalProductPrice from '../GlobalShopComponents/GlobalProductPrice';
import dynamic from 'next/dynamic';

const CountryDropdownServer = dynamic(() => import('./CountryDropDownServerFloating'));

const Categories = () => {
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
              <h2 className='font-extrabold text-white text-2xl text-center'>
                {products.headerTitle}
              </h2>

              <div className='grid gap-8 grid-cols-2 md:grid-cols-1'>
                {/* Map through  */}
                {products.content.map(async (product) => {
                  const { ssrText, usdCentsBase } = await formatServerPriceForId(product.productId);
                  return (
                    <div className='grid gap-4 p-4' key={product.productId}>
                      <CustomShopLink
                        className='grid gap-2 xl:gap-4'
                        href={`/shop/product/${product.productId}`}
                      >
                        <Image
                          className='w-git merge dev h-[250px] object-contain object-center md:h-[120px] xl:h-[150px] 2xl:h-[200px]'
                          src={`/${product.image_name}`}
                          alt={product.img_alt}
                          width={200}
                          height={200}
                          quality={100}
                        />

                        <h6 className='text-center font-bold'>
                          <GlobalProductPrice
                            ssrText={ssrText}
                            usdCentsBase={usdCentsBase ?? 0}
                            className='text-lg font-semibold'
                          />
                        </h6>
                      </CustomShopLink>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ))}
      </div>

      <CountryDropdownServer />
    </div>
  );
};

export default Categories;
