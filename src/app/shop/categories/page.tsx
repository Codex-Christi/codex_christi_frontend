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
    <div className='bg-[#4C3D3D3D] backdrop-blur-[10px] pt-10 !px-2 rounded-[10px] w-[80vw] mx-auto max-w-[1200px]'>
      <h1 className='text-3xl'>Categories</h1>
      {JSON.stringify(existingCategoriesWithIconsandHrefs)}
    </div>
  );
};

export default AllCategoriesPage;
