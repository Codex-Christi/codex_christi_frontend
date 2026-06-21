import 'server-only';

import { getAdminOpsLedgerPrisma } from '@/lib/prisma/adminOpsLedger/adminOpsLedgerPrisma';
import {
  ADMIN_OPS_LEDGER_MINIMUM_STORAGE_RETENTION_POLICY,
  previewAdminOpsLedgerPrune,
  pruneAdminOpsLedger,
  type AdminOpsLedgerRetentionPolicy,
} from './admin-ops-ledger-maintenance-core';

export async function previewAdminOpsLedgerMinimumStoragePrune() {
  return previewAdminOpsLedgerPrune({
    policy: ADMIN_OPS_LEDGER_MINIMUM_STORAGE_RETENTION_POLICY,
    prisma: getAdminOpsLedgerPrisma(),
  });
}

export async function runAdminOpsLedgerPrune({
  policy,
}: {
  policy: AdminOpsLedgerRetentionPolicy;
}) {
  return pruneAdminOpsLedger({
    policy,
    prisma: getAdminOpsLedgerPrisma(),
  });
}
