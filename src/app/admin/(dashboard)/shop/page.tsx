import type { Metadata } from 'next';
import AdminShopDashboardClient from '@/components/UI/Admin/AdminShopDashboardClient';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { getPayPalLedgerWebhookDashboard } from '@/lib/paypal/txLedger/adminPayPalLedgerWebhooks';
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
  const [recoveryRows, reconciliationSummary, webhookDashboard] = await Promise.all([
    listAdminPaidOrderRecoveryRows().then((result) => result.rows),
    getPayPalPaymentReconciliationDashboardSummary(),
    getPayPalLedgerWebhookDashboard(),
  ]);

  return (
    <AdminShopDashboardClient
      recoveryRows={recoveryRows}
      paymentReconciliationAttentionCount={reconciliationSummary.total}
      paymentReconciliationCriticalCount={reconciliationSummary.critical}
      paymentReconciliationWarningCount={reconciliationSummary.warning}
      paypalWebhookAttentionCount={
        webhookDashboard.summary.driftCount +
        webhookDashboard.summary.envMissingCount +
        webhookDashboard.summary.safetyWarningCount
      }
      paypalWebhookActiveDbCount={webhookDashboard.summary.activeDbBindings}
      paypalWebhookSafetyWarnings={webhookDashboard.safetyWarnings}
    />
  );
}
