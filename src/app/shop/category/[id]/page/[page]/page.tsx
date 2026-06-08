import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import CategoryPageView, { generateCategoryPageMetadata } from '../../CategoryPageView';
import { getCategoryPagePath } from '@/lib/utils/shop/categoryPagePath';

type PageProps = {
  params: Promise<{ id: string; page: string }>;
};

function parseCategoryPage(pageParam: string) {
  const page = Number.parseInt(pageParam, 10);
  if (!Number.isSafeInteger(page) || page < 1) return null;
  return page;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: categoryName, page: pageParam } = await params;
  const page = parseCategoryPage(pageParam);
  if (!page) return { title: 'Product not found' };

  return generateCategoryPageMetadata(categoryName, page);
}

export default async function EachCategoryPaginatedPage({ params }: PageProps) {
  const { id: categoryName, page: pageParam } = await params;
  const page = parseCategoryPage(pageParam);

  if (!page) {
    return notFound();
  }

  if (page === 1) {
    redirect(getCategoryPagePath(categoryName, 1));
  }

  return <CategoryPageView categoryName={categoryName} page={page} />;
}
