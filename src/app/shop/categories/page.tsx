import { useMemo } from 'react';
import { categories as subNavCategoriesWithIcons } from '@/components/UI/Shop/ShopSubNav/SubNavObj';

const AllCategoriesPage = () => {
  const existingCategories = useMemo(
    () => ['launch-merch', 't-shirts', 'hoodies', 'headwears'],
    [],
  );

  const existingCategoriesWithIconsandHrefs = subNavCategoriesWithIcons.filter((cat) =>
    existingCategories.includes(cat.textValue.toLowerCase()),
  );

  return (
    <div
      className=' backdrop-blur-[10px] py-10 my-10 rounded-[10px] w-[80vw] mx-auto max-w-[1200px]'
      style={{
        background:
          'linear-gradient(180deg, rgba(243, 243, 243, 0.1) 0% 0%, rgba(141, 141, 141, 0.1) 100% 100%)',
      }}
    >
      <h1 className='text-3xl font-semibold font-inter'>Categories</h1>
      {JSON.stringify(existingCategoriesWithIconsandHrefs)}
    </div>
  );
};

export default AllCategoriesPage;
