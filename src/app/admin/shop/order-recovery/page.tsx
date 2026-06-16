import type { Metadata } from 'next';
import AdminShopOrderRecoveryClient from '@/components/UI/Admin/AdminShopOrderRecoveryClient';
import CometsContainer from '@/components/UI/general/CometsContainer';
import { listAdminOrderRecoveryRows } from '@/lib/paypal/txLedger/adminOrderRecovery';

export const metadata: Metadata = {
  title: 'Order Recovery | Codex Christi Admin',
  description: 'Provider-neutral order recovery queue for paid, paused, failed, and support workflows.',
};

export default async function AdminOrderRecoveryPage() {
  const rows = await listAdminOrderRecoveryRows();

  return (
    <CometsContainer>
      <AdminShopOrderRecoveryClient rows={rows} />
    </CometsContainer>
  );
}
