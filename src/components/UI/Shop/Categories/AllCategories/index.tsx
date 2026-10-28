import { categories as subNavCategoriesWithIcons } from '@/components/UI/Shop/ShopSubNav/SubNavObj';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import { STOREFRONT_SNAPSHOT_CATEGORY_SLUGS } from '@/lib/merchizeStorefront/categories';
import styles from '@/app/shop/categories/styles.module.css';
import { BsRocket } from 'react-icons/bs';

const categorySlugs = new Set<string>(STOREFRONT_SNAPSHOT_CATEGORY_SLUGS);
const gridCategories = [
  { SvgElem: BsRocket, textValue: 'Launch-merch', href: '/launch-merch' },
  ...subNavCategoriesWithIcons.filter(({ href }) => categorySlugs.has(href.slice(1))),
];

export default function AllCategories() {
  return (
    <main
      className=' backdrop-blur-[10px] my-10 rounded-[10px] p-3 py-10  w-full sm:w-[80vw] lg:w-[75%] mx-auto max-w-[1200px] 
      md:p-10 !pb-24'
      style={{
        background:
          'linear-gradient(180deg, rgba(243, 243, 243, 0.1) 0% 0%, rgba(141, 141, 141, 0.1) 100% 100%)',
      }}
    >
      <h1 className='text-3xl font-semibold font-inter mb-7'>Categories</h1>

      <section className='grid grid-cols-3 border rounded-2xl border-[#f3f3f3]'>
        {gridCategories.map(({ SvgElem, textValue, href }) => (
          <CustomShopLink
            key={href}
            className={`${styles['category-grid-item']} flex flex-col gap-2 items-center justify-center mx-auto
              px-2 py-8 sm:px-4 sm:py-10 lg:p-10 w-full
              group hover:bg-black/50 hover:backdrop-blur-sm`}
            href={`/shop/category${href}`}
            tabIndex={0}
          >
            <h2
              className='max-w-full text-center text-sm sm:text-base break-words group-hover:scale-125 group-hover:font-semibold group-hover:font-ocr
                group-focus-visible:underline transition-transform duration-300 ease-in-out'
            >
              {textValue}
            </h2>
            <SvgElem
              className='group-hover:scale-150 transition-transform duration-300 ease-in-out'
              width={30}
              height={30}
              size={30}
            />
          </CustomShopLink>
        ))}
      </section>
    </main>
  );
}
