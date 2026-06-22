import type { Metadata } from 'next';
import AdminPayPalLedgerWebhooksClient from '@/components/UI/Admin/AdminPayPalLedgerWebhooksClient';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { getPayPalLedgerWebhookDashboard } from '@/lib/paypal/txLedger/adminPayPalLedgerWebhooks';

export const metadata: Metadata = {
  title: 'PayPal Ledger Webhooks | Codex Christi Admin',
  description:
    'Shop admin controls for PayPal ledger transaction webhook env and DB trust bindings.',
};

export const dynamic = 'force-dynamic';

export default async function AdminPayPalLedgerWebhooksPage() {
  await requireAdminPage({
    scope: 'shop.view',
    returnPath: '/admin/shop/paypal-webhooks',
  });

  const dashboard = await getPayPalLedgerWebhookDashboard({ notifyOnDrift: true });

  return <AdminPayPalLedgerWebhooksClient dashboard={dashboard} />;
}
