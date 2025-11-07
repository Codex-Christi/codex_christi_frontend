import Orders from './_components/orders';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Order History | Codex Christi Shop',
  description: 'View and track your orders',
};

const OrderHistory = () => {
  return <Orders />;
};

export default OrderHistory;
