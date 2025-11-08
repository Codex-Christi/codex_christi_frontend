// app/category/[id]/PaginationControls.tsx
'use client';

import { useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/UI/primitives/button';

export default function PaginationControls({
  currentPage,
  totalPages,
  limit,
}: {
  currentPage: number;
  totalPages: number;
  category: string;
  limit: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    params.set('limit', limit.toString());

    // Use history API for true shallow routing
    const newUrl = `${pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);

    // Dispatch custom event for ProductList to listen to
    window.dispatchEvent(new CustomEvent('urlchange'));
  };

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

  return (
    <div className='flex justify-center items-center my-8 space-x-1'>
      <Button
        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
        name='Go to Previous Page'
        className={`p-2 rounded ${
          currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-900'
        }`}
        disabled={currentPage === 1}
        aria-disabled={currentPage === 1}
      >
        <ChevronLeft size={20} />
      </Button>

      {getPageNumbers().map((pageNum, index) =>
        pageNum === '...' ? (
          <span key={`ellipsis-${index}`} className='px-3 py-1'>
            ...
          </span>
        ) : (
          <Button
            onClick={() => handlePageChange(Number(pageNum))}
            name={`Go to Page ${pageNum}`}
            key={pageNum}
            className={`px-3 py-1 rounded ${
              currentPage === pageNum ? 'bg-black text-white' : 'hover:bg-gray-600'
            }`}
          >
            {pageNum}
          </Button>
        ),
      )}

      <Button
        name='Go to Next Page'
        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
        className={`p-2 rounded ${
          currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100'
        }`}
        disabled={currentPage === totalPages}
        aria-disabled={currentPage === totalPages}
      >
        <ChevronRight size={20} />
      </Button>
    </div>
  );
}
