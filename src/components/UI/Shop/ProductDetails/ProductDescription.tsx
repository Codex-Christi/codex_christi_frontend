import { useProductDetailsContext } from '.';
import DOMPurify from 'isomorphic-dompurify';
export const ProductDescription = () => {
  // Hooks and Contexts
  const productDetailsContext = useProductDetailsContext();

  const { description } = productDetailsContext.productMetaData;
  const sanitizedHTML = DOMPurify.sanitize(description);

  // Main JSX
  return (
    <div
      className={`bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-2 lg:p-8 
    ${description.length > 300 ? 'min-h-[800px]' : ''}`}
    >
      <h2 className='font-bold text-2xl'>Product Details</h2>

      <div className='grid gap-3' dangerouslySetInnerHTML={{ __html: sanitizedHTML }}></div>
    </div>
  );
};
