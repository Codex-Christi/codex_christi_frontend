import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';

export function ProductDescriptionSection({ description }: { description: string }) {
  const sanitizedHTML = DOMPurify.sanitize(description, {
    FORBID_ATTR: ['style'],
  });
  const responsiveHTML = wrapRemoteTables(sanitizedHTML);

  return (
    <div
      className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-4 min-h-0 overflow-hidden lg:p-8
      [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white
      [&_p]:text-sm [&_p]:leading-7 [&_p]:text-slate-100
      [&_ul]:grid [&_ul]:gap-2 [&_ul]:pl-5 [&_li]:list-disc [&_li]:text-sm [&_li]:leading-6
      [&_.product-table-outer]:w-full [&_.product-table-outer]:min-w-0 [&_.product-table-outer]:max-w-full [&_.product-table-outer]:overflow-hidden
      [&_.product-size-table-scroll]:mt-4 [&_.product-size-table-scroll]:w-full [&_.product-size-table-scroll]:min-w-0 [&_.product-size-table-scroll]:max-w-full [&_.product-size-table-scroll]:overflow-x-auto
      [&_.product-size-table-scroll]:rounded-xl [&_.product-size-table-scroll]:border [&_.product-size-table-scroll]:border-white/15
      [&_.product-size-table-scroll]:bg-slate-950/20 [&_.product-size-table-scroll]:[-webkit-overflow-scrolling:touch]
      [&_table]:min-w-[42rem] [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm
      [&_thead]:bg-slate-950/60 [&_tbody_tr:nth-child(even)]:bg-white/5
      [&_th]:!w-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-white/15 [&_th]:px-3 [&_th]:py-3 [&_th]:font-semibold [&_th]:text-white
      [&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-slate-100'
    >
      <h2 className='font-bold text-2xl'>Product Details</h2>

      <div
        className='grid min-w-0 gap-3 overflow-hidden'
        dangerouslySetInnerHTML={{ __html: responsiveHTML }}
      />
    </div>
  );
}

function wrapRemoteTables(html: string) {
  return html
    .replace(/class=(["'])([^"']*\bdataTables_wrapper\b[^"']*)\1/gi, (_match, quote, className) => {
      if (className.includes('product-table-outer')) {
        return `class=${quote}${className}${quote}`;
      }

      return `class=${quote}${className} product-table-outer${quote}`;
    })
    .replace(
      /<table\b([^>]*)>/gi,
      '<div class="product-size-table-scroll" role="region" aria-label="Product size chart" tabindex="0"><table$1>',
    )
    .replace(/<\/table>/gi, '</table></div>');
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
