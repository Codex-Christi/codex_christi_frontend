import type { Metadata } from 'next';
import AdminDashboardClient from '@/components/UI/Admin/AdminDashboardClient';
import CometsContainer from '@/components/UI/general/CometsContainer';

export const metadata: Metadata = {
  title: 'Shop Admin | Codex Christi',
  description: 'Shop operations dashboard for checkout recovery, ledger repair, and fulfillment support.',
};

export default function ShopAdminPage() {
  return (
    <CometsContainer>
      <AdminDashboardClient scope='shop' />
    </CometsContainer>
  );
}
