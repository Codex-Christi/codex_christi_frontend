import type { Metadata } from 'next';
import AdminShopDashboardClient from '@/components/UI/Admin/AdminShopDashboardClient';
import CometsContainer from '@/components/UI/general/CometsContainer';

export const metadata: Metadata = {
  title: 'Shop Admin | Codex Christi',
  description: 'Shop operations dashboard for checkout recovery, ledger repair, and fulfillment support.',
};

export default function ShopAdminPage() {
  return (
    <CometsContainer>
      <AdminShopDashboardClient scope='shop' />
    </CometsContainer>
  );
}
