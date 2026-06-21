import type { Metadata } from 'next';
import AdminShopPaidOrderRecoveryClient from '@/components/UI/Admin/AdminShopPaidOrderRecoveryClient';
import { requireAdminPage } from '@/lib/admin/require-admin';
import { listAdminPaidOrderRecoveryRows } from '@/lib/paypal/txLedger/adminPaidOrderRecovery';

export const metadata: Metadata = {
  title: 'Paid Order Recovery | Codex Christi Admin',
  description:
    'Provider-neutral paid order recovery queue for paused, failed, and support workflows.',
};

export default async function AdminPaidOrderRecoveryPage() {
  await requireAdminPage({
    scope: 'shop.view',
    returnPath: '/admin/shop/paid-order-recovery',
  });

  const rows = await listAdminPaidOrderRecoveryRows();

  return <AdminShopPaidOrderRecoveryClient rows={rows} />;
}
