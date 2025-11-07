import ShippingAddress from './_components/shipping-address';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shippping Address | Codex Christi Shop',
  description: 'View and edit your shipping wishlist',
};

const ShippingAddressPage = () => {
  return (
    <ShippingAddress />
  );
};

export default ShippingAddressPage;
