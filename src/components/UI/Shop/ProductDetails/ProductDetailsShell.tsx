import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ProductResult } from '@/lib/merchizeStorefront/productTypes';
import ProductPurchasePanel from '.';
import { ProductImageGallery } from './ProductImageGallery';

const reviews = [
  'Very comfortable, fits perfectly and I think it is affordable for the above price.',
  'This hoodie is stylish and comfy. I wear it almost every day. The design is simple but trendy, and it goes well with everything. Highly recommend.',
  'I really like the quality of the hoodie, but it runs a bit small. I would suggest ordering one size up if you prefer a looser fit. Other than that, it is great.',
];

function ReviewStars() {
  return (
    <div aria-label='5 out of 5 stars' className='flex gap-0.5' role='img'>
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          aria-hidden='true'
          width='17'
          height='16'
          viewBox='0 0 17 16'
          fill='none'
        >
          <path
            d='M7.57994 1.85667C7.94432 1.10486 9.01532 1.10486 9.3797 1.85667L10.8177 4.82357C10.9634 5.12426 11.2497 5.33229 11.5807 5.37801L14.848 5.82936C15.6755 5.94367 16.0064 6.9621 15.4041 7.54095L13.0262 9.82624C12.7853 10.0578 12.676 10.3943 12.7348 10.7232L13.3151 13.9692C13.4621 14.7915 12.5956 15.421 11.859 15.0269L8.95147 13.4716C8.65679 13.314 8.30284 13.314 8.00816 13.4716L5.10015 15.0269C4.36346 15.421 3.49703 14.7914 3.64415 13.969L4.22477 10.7233C4.28361 10.3943 4.17426 10.0577 3.93333 9.82618L1.55556 7.54095C0.953272 6.9621 1.28416 5.94367 2.11166 5.82936L5.37894 5.37801C5.70994 5.33229 5.99623 5.12426 6.14197 4.82356L7.57994 1.85667Z'
            fill='white'
          />
        </svg>
      ))}
    </div>
  );
}

type ProductDetailsShellProps = {
  productId: string;
  fetchedProductData: ProductResult;
  initialImageUrls: string[];
  descriptionSection: ReactNode;
};

export default function ProductDetailsShell({
  productId,
  fetchedProductData,
  initialImageUrls,
  descriptionSection,
}: ProductDetailsShellProps) {
  return (
    <div className='grid min-w-0 gap-8 items-start px-2 py-12 md:px-[20px] lg:px-[24px] lg:grid-cols-6 xl:grid-cols-3'>
      <div className='grid min-w-0 gap-4 lg:col-span-4 xl:col-span-2'>
        <ProductImageGallery
          productMetaData={fetchedProductData.productMetaData}
          initialImageUrls={initialImageUrls}
        />
      </div>

      <ProductPurchasePanel
        key={productId}
        productId={productId}
        fetchedProductData={fetchedProductData}
        initialImageUrls={initialImageUrls}
      />

      <div className='grid gap-4 lg:col-span-4 xl:col-span-2'>
        {descriptionSection}

        <div className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-2 lg:p-8'>
          <h2 className='font-bold text-2xl'>Specifications</h2>

          <ul className='space-y-2 list-disc list-inside'>
            <li>Quality fabric</li>
            <li>Thick & comfortable</li>
            <li>Sharp print</li>
            <li>Overhead</li>
            <li>Unisex</li>
            <li>Hoodie</li>
          </ul>
        </div>

        <div className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-8 lg:p-8'>
          <div className='space-y-1'>
            <h2 className='font-bold text-2xl'>Customer Reviews & Ratings</h2>
            <p>4.8 out of 5 Stars</p>
          </div>

          <div className='space-y-4'>
            {reviews.map((review) => (
              <div className='space-y-1' key={review}>
                <ReviewStars />
                <p>{review}</p>
              </div>
            ))}
          </div>

          <div className='grid place-content-center'>
            <Link className='border border-white p-[10px] rounded-md' href=''>
              See more reviews
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
