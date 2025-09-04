// app/category/[id]/ProductCard.tsx
import Image from 'next/image';
import { CategoryProductDetail } from './categoryDetailsSSR';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import { Button } from '@/components/UI/primitives/button';

export default function ProductCard({ product }: { product: CategoryProductDetail }) {
  const { title, _id } = product;
  return (
    <CustomShopLink
      href={`/shop/product/${_id}`}
      className='relative bg-white/10 backdrop-blur-md rounded-xl py-8 pt-0 
        border-[2px] border-white/50 overflow-hidden mx-auto w-full max-w-[310px]
        lg:max-w-[350px] hover:scale-[1.03]'
    >
      <div className='relative h-auto'>
        <Image
          src={product.image}
          alt={product.title}
          // fill
          height={300}
          width={150}
          className='object-cover object-top aspect-[16/18] md:aspect-[16/13] !w-full'
          style={{
            filter: isDayOrNight() === 'night' ? 'brightness(.8) contrast(.9)' : 'none',
          }}
          // sizes='(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
        />
      </div>
      <div className='pt-4 px-4 flex flex-col gap-2'>
        <h3 className='font-semibold text-lg mb-1'>{product.title}</h3>
        <div className='flex justify-between items-center'>
          <span className='font-bold'>${Number(product.retail_price).toFixed(2)}</span>
          <Button
            onClick={(e) => {
              e.preventDefault();
            }}
            name={`Add ${title} to cart`}
            className='px-3 py-1 bg-[#0085FF] font-ocr text-[0.95rem] font-[900] rounded-md
             hover:bg-gray-500 transition-colors hover:scale-110'
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </CustomShopLink>
  );
}

function isDayOrNight() {
  const currentHour = new Date().getHours(); // Get the current hour (0-23)
  // Define a range for "day" hours. For instance, 6 AM to 8 PM.
  if (currentHour >= 6 && currentHour < 20) {
    return 'day';
  } else {
    return 'night';
  }
}
