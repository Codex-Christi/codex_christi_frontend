import { Metadata } from 'next';
import CategoryPageView, { generateCategoryPageMetadata } from './CategoryPageView';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: categoryName } = await params;
  return generateCategoryPageMetadata(categoryName, 1);
}

export default async function EachCategoryPage({ params }: PageProps) {
  const { id: categoryName } = await params;
  return <CategoryPageView categoryName={categoryName} page={1} />;
}
