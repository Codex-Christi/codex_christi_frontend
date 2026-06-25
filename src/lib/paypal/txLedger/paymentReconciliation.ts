import 'server-only';

import {
  clampPaymentReconciliationBatchSize,
  findPayPalPaymentReconciliationRows,
  getPaymentReconciliationScannerBatchSize,
  getPaymentReconciliationScannerEnabled,
  getPaymentReconciliationScannerMinAgeMinutes,
  getPayPalPaymentReconciliationDashboard,
  getPayPalPaymentReconciliationDashboardSummary,
  isPaymentReconciliationCandidate,
  PAYMENT_RECONCILIATION_ROW_SELECT,
} from '@/lib/paypal/txLedger/paymentReconciliationDashboard';
import { reconcilePaymentRow } from '@/lib/paypal/txLedger/paymentReconciliationProcessor';
import type { PayPalPaymentReconciliationRunResult } from '@/lib/paypal/txLedger/paymentReconciliationTypes';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';

export {
  findPayPalPaymentReconciliationRows,
  getPayPalPaymentReconciliationDashboard,
  getPayPalPaymentReconciliationDashboardSummary,
};
export type {
  PayPalPaymentReconciliationDashboard,
  PayPalPaymentReconciliationRow,
  PayPalPaymentReconciliationResult,
  PayPalPaymentReconciliationRunResult,
} from '@/lib/paypal/txLedger/paymentReconciliationTypes';

type RunSeed = Omit<PayPalPaymentReconciliationRunResult, 'ok' | 'results' | 'skipped'> & {
  skipped?: PayPalPaymentReconciliationRunResult['skipped'];
};

function createRunResult(seed: RunSeed): PayPalPaymentReconciliationRunResult {
  return { ok: true, results: [], skipped: [], ...seed };
}

async function runCandidateReconciliations(result: PayPalPaymentReconciliationRunResult) {
  if (!result.enabled || result.dryRun) return result;

  for (const candidate of result.candidates) {
    try {
      const row = await paypalTxLedger.paypalIntent.findUnique({
        where: { orderToken: candidate.orderToken },
        select: PAYMENT_RECONCILIATION_ROW_SELECT,
      });

      if (!row || !isPaymentReconciliationCandidate(row)) {
        result.skipped.push({
          orderToken: candidate.orderToken,
          reason: 'Row is no longer eligible for payment reconciliation.',
        });
        continue;
      }

      const reconciliation = await reconcilePaymentRow(row);
      result.ok &&= reconciliation.ok;
      result.results.push(reconciliation);
    } catch (error) {
      result.ok = false;
      result.results.push({
        orderToken: candidate.orderToken,
        ok: false,
        action: 'scanner_failed',
        previousStatus: candidate.status,
        status: null,
        message: error instanceof Error ? error.message : String(error),
        captureId: candidate.captureId,
        authorizationStatus: null,
        notificationCreated: 0,
      });
    }
  }

  return result;
}

export async function runPayPalPaymentReconciliationScanner(args?: {
  dryRun?: boolean;
  batchSize?: number;
  minAgeMinutes?: number;
}) {
  const enabled = getPaymentReconciliationScannerEnabled();
  const minAgeMinutes = args?.minAgeMinutes ?? getPaymentReconciliationScannerMinAgeMinutes();
  const batchSize = clampPaymentReconciliationBatchSize(
    args?.batchSize ?? getPaymentReconciliationScannerBatchSize(),
  );
  const scannedAt = new Date();
  const candidates = enabled
    ? await findPayPalPaymentReconciliationRows({ batchSize, minAgeMinutes, now: scannedAt })
    : [];

  return runCandidateReconciliations(
    createRunResult({
      enabled,
      dryRun: args?.dryRun ?? false,
      minAgeMinutes,
      batchSize,
      scannedAt: scannedAt.toISOString(),
      candidates,
    }),
  );
}

export async function runSelectedPayPalPaymentReconciliation(args: {
  orderTokens: string[];
  dryRun?: boolean;
}) {
  const orderTokens = [...new Set(args.orderTokens.map((token) => token.trim()))].filter(Boolean);
  const minAgeMinutes = getPaymentReconciliationScannerMinAgeMinutes();
  const batchSize = clampPaymentReconciliationBatchSize(getPaymentReconciliationScannerBatchSize());
  const scannedAt = new Date();
  const candidates = await findPayPalPaymentReconciliationRows({
    batchSize,
    minAgeMinutes,
    now: scannedAt,
    orderTokens,
  });
  const candidateTokens = new Set(candidates.map((candidate) => candidate.orderToken));

  return runCandidateReconciliations(
    createRunResult({
      enabled: getPaymentReconciliationScannerEnabled(),
      dryRun: args.dryRun ?? false,
      minAgeMinutes,
      batchSize,
      scannedAt: scannedAt.toISOString(),
      candidates,
      skipped: orderTokens
        .filter((orderToken) => !candidateTokens.has(orderToken))
        .map((orderToken) => ({
          orderToken,
          reason: 'Row is no longer eligible for payment reconciliation.',
        })),
    }),
  );
}
