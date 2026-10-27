import { Metadata } from 'next';
import '../../route-utilities.css';
import WishlistContent from '@/components/UI/Shop/Wishlist/WishlistContent';
import styles from '@/components/UI/Shop/Wishlist/Wishlist.module.css';

export const metadata: Metadata = {
  title: 'My Wishlist | Codex Christi Shop',
  description: 'View and edit your shopping wishlist',
};
export default function MyWishlistPage() {
  return (
    <main className={styles.page}>
      <WishlistContent />
    </main>
  );
}
