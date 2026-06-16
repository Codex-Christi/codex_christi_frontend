import type { Metadata } from 'next';
import AdminOrderRecoveryClient from '@/components/UI/Admin/AdminOrderRecoveryClient';
import CometsContainer from '@/components/UI/general/CometsContainer';

export const metadata: Metadata = {
  title: 'Order Recovery | Codex Christi Admin',
  description: 'Provider-neutral order recovery queue for paid, paused, failed, and support workflows.',
};

export default function AdminOrderRecoveryPage() {
  return (
    <CometsContainer>
      <AdminOrderRecoveryClient />
    </CometsContainer>
  );
}
