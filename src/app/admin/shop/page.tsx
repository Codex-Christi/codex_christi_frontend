import type { Metadata } from 'next';
import AdminShopDashboardClient from '@/components/UI/Admin/AdminShopDashboardClient';
import CometsContainer from '@/components/UI/general/CometsContainer';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { getPayPalPaymentReconciliationDashboardSummary } from '@/lib/paypal/txLedger/paymentReconciliation';

export const metadata: Metadata = {
  title: 'Shop Admin | Codex Christi',
  description:
    'Shop operations dashboard for checkout recovery, ledger repair, and fulfillment support.',
};

export default async function ShopAdminPage() {
  await requireAdminPage({
    scope: 'shop',
    returnPath: '/admin/shop',
  });
  const reconciliationSummary = await getPayPalPaymentReconciliationDashboardSummary();

  return (
    <CometsContainer>
      <AdminShopDashboardClient
        scope='shop'
        paymentReconciliationAttentionCount={reconciliationSummary.total}
        paymentReconciliationCriticalCount={reconciliationSummary.critical}
      />
    </CometsContainer>
  );
}
