import type { Metadata } from 'next';
import AdminShopPaymentReconciliationClient from '@/components/UI/Admin/AdminShopPaymentReconciliationClient';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { getPayPalPaymentReconciliationDashboard } from '@/lib/paypal/txLedger/paymentReconciliation';

export const metadata: Metadata = {
  title: 'PayPal Reconciliation | Codex Christi Admin',
  description: 'Payment-stage reconciliation for PayPal authorization and capture ledger rows.',
};

export default async function AdminPayPalReconciliationPage() {
  await requireAdminPage({
    scope: 'shop.view',
    returnPath: '/admin/shop/paypal-reconciliation',
  });

  const dashboard = await getPayPalPaymentReconciliationDashboard();

  return <AdminShopPaymentReconciliationClient dashboard={dashboard} />;
}
