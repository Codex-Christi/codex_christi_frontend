import Image from 'next/image';
import NotFoundImage from '@/assets/img/shop-not-found.png';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';

export default function CategoryNotFound() {
  return (
    <main className='mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-12 text-center'>
      <Image src={NotFoundImage} alt='' className='h-auto w-56' sizes='224px' loading='eager' />
      <h1 className='font-ocr text-2xl'>Category not found</h1>
      <p>This category is not available. Explore our other collections.</p>
      <CustomShopLink
        href='/shop/categories'
        className='rounded-lg border border-white/20 bg-white/5 px-5 py-3 backdrop-blur-xl hover:bg-white/10'
      >
        Browse categories
      </CustomShopLink>
    </main>
  );
}
