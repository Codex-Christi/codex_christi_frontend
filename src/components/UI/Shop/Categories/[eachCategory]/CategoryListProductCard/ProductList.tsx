import ProductCard, { type CategoryProductCardData } from './ProductCard';
import RefreshProductsButton from './RefreshProductsButton';

export default function ProductList({
  initialData,
}: {
  initialData: CategoryProductCardData[];
}) {
  return (
    <>
      <div className='mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 min-[900px]:grid-cols-3 xl:!grid-cols-4 gap-6'>
        {initialData.map((product, index) => (
          <ProductCard key={product._id} product={product} priority={index === 0} />
        ))}
      </div>

      <RefreshProductsButton />
    </>
  );
}
