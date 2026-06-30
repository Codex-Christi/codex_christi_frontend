import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import styles from './ProductDetails.module.css';

export function ProductDescriptionSection({ description }: { description: string }) {
  const sanitizedHTML = DOMPurify.sanitize(description, {
    FORBID_ATTR: ['style'],
  });
  const responsiveHTML = optimizeRemoteDescriptionImages(wrapRemoteTables(sanitizedHTML));

  return (
    <div
      className={`${styles.productPanel} ${styles.spaceMedium} ${styles.descriptionPanel}`}
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
