import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';

export function ProductDescriptionSection({ description }: { description: string }) {
  const sanitizedHTML = DOMPurify.sanitize(description);

  return (
    <div
      className={`bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-2 lg:p-8 
    ${description && description.length > 300 ? 'min-h-[1100px] sm-min-h-[950px] lg:min-h-[970px] xl:min-h-[950px]' : ''}
    `}
    >
      <h2 className='font-bold text-2xl'>Product Details</h2>

      <div className='grid gap-3' dangerouslySetInnerHTML={{ __html: sanitizedHTML }}></div>
    </div>
  );
}

export function ProductFeedbackSection() {
  return (
    <div className='space-y-8 mt-4 lg:col-span-2'>
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
  );
}
