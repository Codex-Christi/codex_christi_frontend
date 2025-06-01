import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Wishlist | Codex Christi Shop',
  description: 'View and edit your shooping wishlist',
};
export default function MyWishlistPage() {
  return (
    <div className='flex flex-col items-center justify-center h-full'>
      <h1 className='text-2xl font-bold mb-4'>My Wishlist</h1>
      <p className='text-gray-600'>Your wishlist is currently empty.</p>
      <p className='text-gray-600'>Start adding products to your wishlist!</p>
    </div>
  );
}
// This page serves as a placeholder for the user's wishlist.
