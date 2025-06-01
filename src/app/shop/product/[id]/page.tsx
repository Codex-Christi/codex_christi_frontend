import Link from 'next/link';
// import Image from 'next/image';
// import Calendar from '@/assets/img/calendar.png';
import ProductCart from '@/components/UI/Shop/ProductDetails/ProductCart';
import ProductSummary from '@/components/UI/Shop/ProductDetails/ProductSummary';
import { Metadata } from 'next';
import { getProductDetailsSSR } from './productDetailsSSR';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
};

// Once we started consuming the API this would be replaced wuth `generateMetadata`
// ✅ 1. Generate metadata dynamically
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const { productMetaData } = await getProductDetailsSSR(id);

    const title = `${productMetaData.title} | Codex Christi Shop`;
    const description = productMetaData.description
      .split('.')[0]
      .replace(/<[^>]*>/g, '');

    return {
      title: title,
      description: `Buy ${productMetaData.title} now. Limited edition.`,
      openGraph: {
        title: title,
        description: description,
        images: [{ url: productMetaData.image }],
        type: 'website',
        url: `https://codexchristi.shop/product/${id}`,
      },
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: description,
        images: productMetaData.image,
      },
    };
  } catch {
    // fallback metadata or suppress entirely
    return {
      title: 'Product not found',
    };
  }
}

// ✅ 2. Main component for the product details page
const ProductDetails = async ({ params }: PageProps) => {
  const { id: productID } = await params;

  //   Main SSR generator
  const productData = await getProductDetailsSSR(productID)
    .then((data) => data)
    .catch((error) => {
      console.error('Error fetching product details:', error);
      return notFound(); // or handle the error as needed
    });

  // Main JSX
  return (
    <div className='grid gap-8 items-start px-2 py-12 md:px-[20px] lg:px-[24px] lg:grid-cols-2'>
      <ProductSummary />

      <ProductCart />

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
  );
};

export default ProductDetails;
