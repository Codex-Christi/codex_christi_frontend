import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';

export function ProductDescriptionSection({ description }: { description: string }) {
  const sanitizedHTML = DOMPurify.sanitize(description, {
    FORBID_ATTR: ['style'],
  });
  const responsiveHTML = optimizeRemoteDescriptionImages(wrapRemoteTables(sanitizedHTML));

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
      [&_td]:whitespace-nowrap [&_td]:border-t [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-slate-100
      [&_img]:mx-auto [&_img]:h-auto [&_img]:w-full [&_img]:max-w-[500px] [&_img]:rounded-lg'
    >
      <h2 className='font-bold text-2xl'>Product Details</h2>

      <div
        className='grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 overflow-hidden'
        dangerouslySetInnerHTML={{ __html: responsiveHTML }}
      />
    </div>
  );
}

const OPTIMIZED_DESCRIPTION_IMAGE_WIDTHS = [320, 480, 512, 640] as const;
const OPTIMIZED_DESCRIPTION_IMAGE_QUALITY = 75;

function isOptimizableDescriptionImage(src: string) {
  try {
    const url = new URL(src);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'merchize.com' || url.hostname === 'www.merchize.com') &&
      url.pathname.startsWith('/wp-content/uploads/')
    );
  } catch {
    return false;
  }
}

function optimizedImageUrl(src: string, width: number) {
  return `/_next/image?url=${encodeURIComponent(src)}&amp;w=${width}&amp;q=${OPTIMIZED_DESCRIPTION_IMAGE_QUALITY}`;
}

function setHtmlAttribute(tag: string, name: string, value: string) {
  const attributePattern = new RegExp(`\\s${name}\\s*=\\s*(["'])[^"']*\\1`, 'i');
  const attribute = ` ${name}="${value}"`;

  if (attributePattern.test(tag)) {
    return tag.replace(attributePattern, attribute);
  }

  return tag.replace(/\s*\/?>$/, (ending) => `${attribute}${ending}`);
}

function optimizeRemoteDescriptionImages(html: string) {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/\ssrc\s*=\s*(["'])(.*?)\1/i);
    const src = srcMatch?.[2];
    if (!src || !isOptimizableDescriptionImage(src)) return tag;

    const srcSet = OPTIMIZED_DESCRIPTION_IMAGE_WIDTHS.map(
      (width) => `${optimizedImageUrl(src, width)} ${width}w`,
    ).join(', ');

    return [
      ['src', optimizedImageUrl(src, 512)],
      ['srcset', srcSet],
      ['sizes', '(max-width: 548px) calc(100vw - 48px), 500px'],
      ['loading', 'lazy'],
      ['decoding', 'async'],
      ['fetchpriority', 'low'],
    ].reduce((updatedTag, [name, value]) => setHtmlAttribute(updatedTag, name, value), tag);
  });
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
