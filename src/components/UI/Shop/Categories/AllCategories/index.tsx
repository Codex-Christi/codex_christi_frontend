'use client';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { categories as subNavCategoriesWithIcons } from '@/components/UI/Shop/ShopSubNav/SubNavObj';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import styles from '@/app/shop/categories/styles.module.css';
import { BsRocket } from 'react-icons/bs';
import { IconType } from 'react-icons/lib';

//Get last x elements of awway
function getLastXElements<T>(arr: T[], x: number): T[] {
  // Handle cases where x is less than or equal to 0, or greater than array length
  if (x <= 0) {
    return []; // Return an empty array if x is 0 or negative
  }
  if (x >= arr.length) {
    return [...arr]; // Return a shallow copy of the entire array if x is too large
  }
  // Use slice with a negative index to get the last x elements
  return arr.slice(-x);
}

// Main Component
const AllCategoriesClientComponent = () => {
  const existingCategories = useMemo(
    () => ['launch-merch', 't-shirts', 'hoodies', 'headwears', 'jackets'],
    [],
  );
  const categoriesGridRef = useRef<HTMLElement>(null);
  const [numOfGridChildren, setNumOfGridChildren] = useState<number | null>(null);

  const existingCategoriesWithIconsandHrefs = subNavCategoriesWithIcons.filter((cat) =>
    existingCategories.includes(cat.textValue.toLowerCase()),
  );

  useEffect(() => {
    const categoriesGridChildren = Array.from(
      categoriesGridRef!.current!.children ?? [],
    ) as HTMLAnchorElement[];
    const numofChildren = categoriesGridChildren?.length;
    setNumOfGridChildren(numofChildren);

    if (numofChildren && categoriesGridChildren && numofChildren > 3) {
      const remainder = numofChildren % 3;

      const selectElems = getLastXElements(
        categoriesGridChildren,
        remainder === 0 ? 3 : remainder === 2 ? 2 : 1,
      );

      const clearer = setTimeout(
        () =>
          selectElems.forEach((each) => {
            each.classList.add('!border-b-0');
          }),
        1,
      );

      return () => clearTimeout(clearer);
    }
  }, [setNumOfGridChildren]);

  //   Main JSX
  return (
    <div
      className=' backdrop-blur-[10px] my-10 rounded-[10px] p-3 py-10  w-full sm:w-[80vw] lg:w-[75%] mx-auto max-w-[1200px] 
      md:p-10 !pb-24'
      style={{
        background:
          'linear-gradient(180deg, rgba(243, 243, 243, 0.1) 0% 0%, rgba(141, 141, 141, 0.1) 100% 100%)',
      }}
    >
      <h1 className='text-3xl font-semibold font-inter mb-7'>Categories</h1>

      {/* Categories Grid */}
      <section
        className={`grid grid-cols-3 border rounded-2xl border-[#f3f3f3]`}
        ref={categoriesGridRef}
      >
        {/* Lauch Merch */}
        <ShopLinkWithIcon
          SvgElem={BsRocket}
          textValue='Launch-merch'
          href='/launch-merch'
          numOfGridChildren={numOfGridChildren}
        />

        {/* Other Categories from NavObj */}
        {existingCategoriesWithIconsandHrefs.map(({ SvgElem, textValue, href }, index) => {
          return (
            <ShopLinkWithIcon
              numOfGridChildren={numOfGridChildren}
              key={textValue + index}
              SvgElem={SvgElem}
              href={href}
              textValue={textValue}
            />
          );
        })}
      </section>
    </div>
  );
};

export default AllCategoriesClientComponent;

interface ShopLinkWithIconInterface {
  textValue: string;
  SvgElem:
    | ((props: React.SVGProps<SVGSVGElement>) => JSX.Element)
    | ((props: React.SVGProps<SVGSVGElement>) => JSX.Element)
    | IconType;
  href: string;
  numOfGridChildren?: number | null;
}

const ShopLinkWithIcon: FC<ShopLinkWithIconInterface> = ({
  textValue,
  href,
  SvgElem,
  numOfGridChildren,
}) => {
  // Main JSX
  return (
    <CustomShopLink
      className={`${styles['category-grid-item']} flex flex-col gap-2 items-center justify-center mx-auto 
             p-10 md:p-14 category-grid-item w-full ${numOfGridChildren! > 3 ? 'border-b-[1px]' : ''} 
             group hover:bg-black/50 hover:backdrop-blur-sm`}
      href={`/shop/category${href}`}
      tabIndex={0}
    >
      <h4
        className={`text-nowrap group-hover:scale-125 group-hover:font-semibold group-hover:font-ocr
          group-focus-visible:underline
           transition-transform duration-300 ease-in-out`}
      >
        {textValue}
      </h4>
      <SvgElem
        className='group-hover:scale-150 transition-transform duration-300 ease-in-out'
        width={30}
        height={30}
        size={30}
      />
    </CustomShopLink>
  );
};
