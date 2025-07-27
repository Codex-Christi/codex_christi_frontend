import AllCategoriesClientComponent from '@/components/UI/Shop/Categories/AllCategories';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'All Categories | Codex Christi Shop',
  description: 'Browse all categories on our shop.',
};

const AllCategoriesPage = () => {
  //   Main JSX
  return <AllCategoriesClientComponent />;
};

export default AllCategoriesPage;
