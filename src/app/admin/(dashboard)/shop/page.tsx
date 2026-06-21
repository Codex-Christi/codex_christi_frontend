import type { Metadata } from 'next';
import AdminShopDashboardClient from '@/components/UI/Admin/AdminShopDashboardClient';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { listAdminPaidOrderRecoveryRows } from '@/lib/paypal/txLedger/adminPaidOrderRecovery';
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
  const [recoveryRows, reconciliationSummary] = await Promise.all([
    listAdminPaidOrderRecoveryRows(),
    getPayPalPaymentReconciliationDashboardSummary(),
  ]);

  return (
    <AdminShopDashboardClient
      recoveryRows={recoveryRows}
      paymentReconciliationAttentionCount={reconciliationSummary.total}
      paymentReconciliationCriticalCount={reconciliationSummary.critical}
      paymentReconciliationWarningCount={reconciliationSummary.warning}
    />
  );
}
