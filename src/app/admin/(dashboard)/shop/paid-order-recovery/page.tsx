import type { Metadata } from 'next';
import AdminShopPaidOrderRecoveryClient from '@/components/UI/Admin/AdminShopPaidOrderRecoveryClient';
import { requireAdminPage } from '@/lib/admin/require-admin';
import {
  getPaidOrderRecoveryPage,
  getPaidOrderRecoveryPageSize,
  listAdminPaidOrderRecoveryRows,
  normalizePaidOrderRecoveryFilters,
} from '@/lib/paypal/txLedger/adminPaidOrderRecovery';
import { getLatestAdminPaidOrderRecoveryScannerRun } from './actions';

type AdminPaidOrderRecoveryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: 'Paid Order Recovery | Codex Christi Admin',
  description:
    'Provider-neutral paid order recovery queue for paused, failed, and support workflows.',
};

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPaidOrderRecoveryPage({
  searchParams,
}: AdminPaidOrderRecoveryPageProps) {
  const params = (await searchParams) ?? {};
  const filters = normalizePaidOrderRecoveryFilters({
    search: getParamValue(params.search),
    status: getParamValue(params.status),
  });
  const page = getPaidOrderRecoveryPage(getParamValue(params.page));
  const pageSize = getPaidOrderRecoveryPageSize(getParamValue(params.pageSize));

  await requireAdminPage({
    scope: 'shop.view',
    returnPath: '/admin/shop/paid-order-recovery',
  });

  const [recoveryList, latestScannerRun] = await Promise.all([
    listAdminPaidOrderRecoveryRows({
      filters,
      page,
      pageSize,
    }),
    getLatestAdminPaidOrderRecoveryScannerRun().catch(() => null),
  ]);

  return (
    <AdminShopPaidOrderRecoveryClient
      recoveryList={recoveryList}
      latestScannerRun={latestScannerRun}
    />
  );
}
