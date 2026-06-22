import 'server-only';

import {
  getRecoveryScannerBatchSize,
  getRecoveryScannerMinAgeMinutes,
  isRecoveryScannerEnabled,
} from '@/lib/paypal/txLedger/processingPolicy';
import { runPaidFulfillmentProcessing } from '@/lib/paypal/txLedger/runPaidFulfillmentProcessing';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';

const AUTOMATIC_RECOVERY_STATUSES = [
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
] as const;

const MAX_BATCH_SIZE = 25;

export type PayPalRecoveryScanCandidate = {
  orderToken: string;
  status: string;
  customerEmail: string;
  createdAt: string;
  updatedAt: string;
  reason: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type PayPalRecoveryScanResult = {
  orderToken: string;
  previousStatus: string;
  status: string | null;
  processingCompletedAt: string | null;
  ok: boolean;
  error: string | null;
};

export type PayPalRecoveryScannerRunResult = {
  ok: boolean;
  enabled: boolean;
  dryRun: boolean;
  minAgeMinutes: number;
  batchSize: number;
  scannedAt: string;
  candidates: PayPalRecoveryScanCandidate[];
  results: PayPalRecoveryScanResult[];
  skipped: Array<{
    orderToken: string;
    reason: string;
  }>;
};

function clampBatchSize(batchSize: number) {
  return Math.min(batchSize, MAX_BATCH_SIZE);
}

function toCandidate(row: {
  orderToken: string;
  status: string;
  customerEmail: string;
  capturePayload: unknown;
  createdAt: Date;
  updatedAt: Date;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}) {
  const captureCompletion = getPayPalCaptureCompletion(row.capturePayload);

  return {
    orderToken: row.orderToken,
    status: row.status,
    customerEmail: row.customerEmail,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reason: `${captureCompletion.reason} Post-capture ledger row is still ${row.status}.`,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
  };
}

export async function findPayPalRecoveryCandidates(args?: {
  batchSize?: number;
  minAgeMinutes?: number;
  now?: Date;
  orderTokens?: string[];
}) {
  const now = args?.now ?? new Date();
  const minAgeMinutes = args?.minAgeMinutes ?? getRecoveryScannerMinAgeMinutes();
  const batchSize = clampBatchSize(args?.batchSize ?? getRecoveryScannerBatchSize());
  const cutoff = new Date(now.getTime() - minAgeMinutes * 60_000);
  const orderTokens = args?.orderTokens?.map((orderToken) => orderToken.trim()).filter(Boolean);

  const rows = await paypalTxLedger.paypalIntent.findMany({
    where: {
      ...(orderTokens?.length ? { orderToken: { in: orderTokens } } : {}),
      status: { in: [...AUTOMATIC_RECOVERY_STATUSES] },
      processingCompletedAt: null,
      updatedAt: { lte: cutoff },
      OR: [{ postProcessingLockExpiresAt: null }, { postProcessingLockExpiresAt: { lt: now } }],
    },
    orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
    take: batchSize * 3,
    select: {
      orderToken: true,
      status: true,
      customerEmail: true,
      capturePayload: true,
      createdAt: true,
      updatedAt: true,
      lastErrorCode: true,
      lastErrorMessage: true,
    },
  });

  return rows
    .filter((row) => getPayPalCaptureCompletion(row.capturePayload).ok)
    .slice(0, batchSize)
    .map((row) => toCandidate(row));
}

export async function runPayPalRecoveryScanner(args?: {
  dryRun?: boolean;
  batchSize?: number;
  minAgeMinutes?: number;
}) {
  const enabled = isRecoveryScannerEnabled();
  const minAgeMinutes = args?.minAgeMinutes ?? getRecoveryScannerMinAgeMinutes();
  const batchSize = clampBatchSize(args?.batchSize ?? getRecoveryScannerBatchSize());
  const scannedAt = new Date();
  const candidates = enabled
    ? await findPayPalRecoveryCandidates({ batchSize, minAgeMinutes, now: scannedAt })
    : [];

  const result: PayPalRecoveryScannerRunResult = {
    ok: true,
    enabled,
    dryRun: args?.dryRun ?? false,
    minAgeMinutes,
    batchSize,
    scannedAt: scannedAt.toISOString(),
    candidates,
    results: [],
    skipped: [],
  };

  if (!enabled || result.dryRun) return result;

  for (const candidate of candidates) {
    try {
      await runPaidFulfillmentProcessing(candidate.orderToken, {
        triggerDetail: 'scheduled_recovery_scan',
        triggerSource: 'recovery_scanner',
      });

      const updated = await paypalTxLedger.paypalIntent.findUnique({
        where: { orderToken: candidate.orderToken },
        select: {
          status: true,
          processingCompletedAt: true,
          lastErrorMessage: true,
        },
      });
      const rowCompleted = Boolean(updated?.processingCompletedAt);

      if (!rowCompleted) {
        result.ok = false;
      }

      result.results.push({
        orderToken: candidate.orderToken,
        previousStatus: candidate.status,
        status: updated?.status ?? null,
        processingCompletedAt: updated?.processingCompletedAt?.toISOString() ?? null,
        ok: rowCompleted,
        error: updated?.lastErrorMessage ?? null,
      });
    } catch (error) {
      result.ok = false;
      result.results.push({
        orderToken: candidate.orderToken,
        previousStatus: candidate.status,
        status: null,
        processingCompletedAt: null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function runSelectedPayPalRecoveryScanner(args: {
  orderTokens: string[];
  dryRun?: boolean;
}) {
  const selectedOrderTokens = [...new Set(args.orderTokens.map((token) => token.trim()))].filter(
    Boolean,
  );
  const minAgeMinutes = getRecoveryScannerMinAgeMinutes();
  const batchSize = clampBatchSize(getRecoveryScannerBatchSize());
  const scannedAt = new Date();
  const candidates = await findPayPalRecoveryCandidates({
    batchSize,
    minAgeMinutes,
    now: scannedAt,
    orderTokens: selectedOrderTokens,
  });
  const candidateTokens = new Set(candidates.map((candidate) => candidate.orderToken));
  const result: PayPalRecoveryScannerRunResult = {
    ok: true,
    enabled: isRecoveryScannerEnabled(),
    dryRun: args.dryRun ?? false,
    minAgeMinutes,
    batchSize,
    scannedAt: scannedAt.toISOString(),
    candidates,
    results: [],
    skipped: selectedOrderTokens
      .filter((orderToken) => !candidateTokens.has(orderToken))
      .map((orderToken) => ({
        orderToken,
        reason: 'Row is no longer eligible for automatic recovery.',
      })),
  };

  if (!result.enabled || result.dryRun) return result;

  for (const candidate of candidates) {
    try {
      await runPaidFulfillmentProcessing(candidate.orderToken, {
        triggerDetail: 'selected_recovery_scan',
        triggerSource: 'recovery_scanner',
      });

      const updated = await paypalTxLedger.paypalIntent.findUnique({
        where: { orderToken: candidate.orderToken },
        select: {
          status: true,
          processingCompletedAt: true,
          lastErrorMessage: true,
        },
      });
      const rowCompleted = Boolean(updated?.processingCompletedAt);

      if (!rowCompleted) {
        result.ok = false;
      }

      result.results.push({
        orderToken: candidate.orderToken,
        previousStatus: candidate.status,
        status: updated?.status ?? null,
        processingCompletedAt: updated?.processingCompletedAt?.toISOString() ?? null,
        ok: rowCompleted,
        error: updated?.lastErrorMessage ?? null,
      });
    } catch (error) {
      result.ok = false;
      result.results.push({
        orderToken: candidate.orderToken,
        previousStatus: candidate.status,
        status: null,
        processingCompletedAt: null,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
