'use client';
import { ProductResult } from '@/app/shop/product/[id]/productDetailsSSR';
import dynamic from 'next/dynamic';
const ProductSummary = dynamic(() => import('./ProductSummary'));
const ProductActionsComponents = dynamic(
  () => import('./ProductActionsComponents')
);
import Link from 'next/link';
import { createContext, useContext, FC } from 'react';

interface ProductDetailsProps {
  // Define any props if needed
  fetchedProductData: ProductResult;
}

// Use ProductResult directly as the context type
const ProductDetailsContext = createContext<ProductResult | undefined>(
  undefined
);

export const useProductDetailsContext = () => {
  const context = useContext(ProductDetailsContext);
  if (!context) {
    throw new Error(
      'useProductDetailsContext must be used within ProductDetailsProvider'
    );
  }
  return context;
};

const ProductDetails: FC<ProductDetailsProps> = ({ fetchedProductData }) => {
  return (
    // Main JSX
    <ProductDetailsContext.Provider value={{ ...fetchedProductData }}>
      <div className='grid gap-8 items-start px-2 py-12 md:px-[20px] lg:px-[24px] lg:grid-cols-2'>
        <ProductSummary />
        <ProductActionsComponents />
        <div className='space-y-8 mt-4 lg:col-span-2'>
          {/* <h2 className="font-extrabold text-white text-2xl px-8">
					You might also like
				</h2>

				<div className="bg-[#3D3D3D4D] grid grid-cols-2 gap-8 md:gap-12 px-2 py-10 md:px-8 lg:px-16 text-white md:grid-cols-3 lg:grid-cols-6 items-start justify-between flex-wrap">
					{Array.from({ length: 6 }).map((_, index) => (
						<div
							className="rounded-lg"
							key={index}
						>
							<Image
								className="rounded-t-lg w-full"
								src={Calendar}
								alt="Item"
							/>

							<div className="border-x border-b rounded-b-lg border-white space-y-3 p-2">
								<div className="space-y-2">
									<p className="font-normal">
										2024 Calender with Bible verses
									</p>

									<p className="flex items-center justify-between gap-4">
										<span className="font-bold text-sm">
											N2000
										</span>

										<span className="text-xs line-through">
											N2,500
										</span>
									</p>
								</div>

								<div className="grid place-content-center">
									<Link
										className="text-sm border border-white font-bold p-2 rounded-full inline-block w-auto"
										href=""
									>
										View item
									</Link>
								</div>
							</div>
						</div>
					))}
				</div> */}

          <div className='grid place-content-center gap-4'>
            <p>Please tell us what you think.</p>

            <Link
              className='text-center bg-[#0085FF] px-4 py-3 rounded-lg text-white'
              href='/shop/contact-us/'
            >
              Kindly give us a feedback!
            </Link>
          </div>
        </div>
      </div>
    </ProductDetailsContext.Provider>
  );
};

export default ProductDetails;
