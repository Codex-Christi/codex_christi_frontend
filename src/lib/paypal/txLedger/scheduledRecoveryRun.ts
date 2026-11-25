import 'server-only';

import {
  getAdminOpsLedgerPrisma,
  isAdminOpsLedgerDatabaseConfigured,
} from '@/lib/prisma/adminOpsLedger/adminOpsLedgerPrisma';
import type { ShopOpsDataTargetView } from '@/lib/prisma/shop/shopOpsDataTarget';
import {
  getRecoveryScannerBatchSize,
  getRecoveryScannerMinAgeMinutes,
  isRecoveryScannerEnabled,
} from './processingPolicy';

type Target = NonNullable<ShopOpsDataTargetView['target']>;
type Outcome = 'success' | 'failure';
const action = 'shop.paid_order_recovery.scheduled_run';

function eventScope(target: Target) {
  return { action, targetType: 'shop_ops_data_target', targetId: target };
}

export async function recordScheduledRecoveryRun(target: Target, outcome: Outcome) {
  if (!isAdminOpsLedgerDatabaseConfigured()) return;
  try {
    // Store only the outcome and data target, not the job's order or email details.
    await getAdminOpsLedgerPrisma().adminAuditLog.create({
      data: { ...eventScope(target), outcome },
      select: { id: true },
    });
  } catch {
    console.error('[paypal.recovery_scanner.audit_write_failed]');
  }
}

function paymentRetrySetting() {
  try {
    if (!process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET?.trim()) return 'unconfigured';
    if (!isRecoveryScannerEnabled()) return 'disabled';
    getRecoveryScannerBatchSize();
    getRecoveryScannerMinAgeMinutes();
    return 'enabled';
  } catch {
    return 'unconfigured';
  }
}

export type ScheduledRecoveryRunStatus = {
  paymentRetries: ReturnType<typeof paymentRetrySetting>;
  latest: { outcome: Outcome; at: string } | null;
  lastSuccessAt: string | null;
  unavailable: boolean;
};

export async function readScheduledRecoveryRun(
  target: ShopOpsDataTargetView,
): Promise<ScheduledRecoveryRunStatus> {
  const paymentRetries = paymentRetrySetting();
  const unavailable: ScheduledRecoveryRunStatus = {
    paymentRetries, latest: null, lastSuccessAt: null, unavailable: true,
  };
  if (!target.aligned || !target.target || !isAdminOpsLedgerDatabaseConfigured()) return unavailable;
  try {
    const logs = getAdminOpsLedgerPrisma().adminAuditLog;
    const where = eventScope(target.target);
    const orderBy = { createdAt: 'desc' } as const;
    const latest = await logs.findFirst({
      where: { ...where, outcome: { in: ['success', 'failure'] } },
      orderBy,
      select: { outcome: true, createdAt: true },
    });
    if (!latest) return { ...unavailable, unavailable: false };
    const success = latest.outcome === 'success'
      ? latest
      : await logs.findFirst({
          where: { ...where, outcome: 'success' },
          orderBy,
          select: { createdAt: true },
        });
    return {
      paymentRetries,
      latest: {
        outcome: latest.outcome === 'success' ? 'success' : 'failure',
        at: latest.createdAt.toISOString(),
      },
      lastSuccessAt: success?.createdAt.toISOString() ?? null,
      unavailable: false,
    };
  } catch {
    return unavailable;
  }
}
