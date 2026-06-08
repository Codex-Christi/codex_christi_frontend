import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getCategoryPagePath } from '@/lib/utils/shop/categoryPagePath';

export default function PaginationControls({
  category,
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
  category: string;
}) {
  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) pages.push(1, '...');
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    if (endPage < totalPages) pages.push('...', totalPages);

    return pages;
  };

  const linkClassName =
    'inline-flex items-center justify-center rounded px-3 py-1 hover:bg-gray-600';
  const iconLinkClassName = 'inline-flex items-center justify-center rounded p-2 hover:bg-gray-900';
  const disabledClassName =
    'inline-flex items-center justify-center rounded p-2 text-gray-300 cursor-not-allowed';

  return (
    <div className='flex justify-center items-center my-8 space-x-1'>
      {currentPage === 1 ? (
        <span className={disabledClassName} aria-disabled='true' aria-label='Previous page'>
          <ChevronLeft size={20} />
        </span>
      ) : (
        <Link
          href={getCategoryPagePath(category, currentPage - 1)}
          className={iconLinkClassName}
          aria-label='Previous page'
        >
          <ChevronLeft size={20} />
        </Link>
      )}

      {getPageNumbers().map((pageNum, index) =>
        pageNum === '...' ? (
          <span key={`ellipsis-${index}`} className='px-3 py-1'>
            ...
          </span>
        ) : (
          <Link
            href={getCategoryPagePath(category, Number(pageNum))}
            key={pageNum}
            className={`${linkClassName} ${
              currentPage === pageNum ? 'bg-black text-white' : 'hover:bg-gray-600'
            }`}
            aria-current={currentPage === pageNum ? 'page' : undefined}
            aria-label={`Go to page ${pageNum}`}
          >
            {pageNum}
          </Link>
        ),
      )}

      {currentPage === totalPages ? (
        <span className={disabledClassName} aria-disabled='true' aria-label='Next page'>
          <ChevronRight size={20} />
        </span>
      ) : (
        <Link
          href={getCategoryPagePath(category, currentPage + 1)}
          className={iconLinkClassName}
          aria-label='Next page'
        >
          <ChevronRight size={20} />
        </Link>
      )}
    </div>
  );
}
