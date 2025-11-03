import WishlistItems from "./_components/wishlist-items";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wishlist | Codex Christi Shop',
  description: 'Manage your shopping wishlist',
};

const Wishlist = () => {
    return (
        <WishlistItems />
    );
};

export default Wishlist;
