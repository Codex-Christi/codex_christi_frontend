import type { Metadata } from 'next';
import AdminShopDashboardClient from '@/components/UI/Admin/AdminShopDashboardClient';
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
    <AdminShopDashboardClient
      paymentReconciliationAttentionCount={reconciliationSummary.total}
      paymentReconciliationCriticalCount={reconciliationSummary.critical}
    />
  );
}
