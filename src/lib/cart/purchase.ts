import {
  parseCanonicalOrderSnapshotFromLedger,
  type CanonicalOrderSnapshotLedgerEnvelope,
} from '@/lib/paypal/orderSnapshot/canonicalize';
import type { getCanonicalPaymentProjectionState } from '@/lib/paypal/txLedger/canonicalPaymentProjectionState';
import type { CartPurchase } from './types';

type PaymentEvidence = Pick<
  ReturnType<typeof getCanonicalPaymentProjectionState>,
  'captureCompletion' | 'paymentSafeForPostProcessing' | 'paymentFailure'
>;

/** Server-only extraction: canonicalize imports node:crypto and verifies the sealed snapshot. */
export function getCapturedCartPurchase(
  row: CanonicalOrderSnapshotLedgerEnvelope & { orderToken: string },
  evidence: PaymentEvidence,
): CartPurchase | null {
  if (
    !evidence.captureCompletion.ok ||
    !evidence.paymentSafeForPostProcessing ||
    evidence.paymentFailure
  )
    return null;

  try {
    const parsed = parseCanonicalOrderSnapshotFromLedger(row);
    if (parsed.mode !== 'canonical') return null;
    return {
      orderId: row.orderToken,
      lines: parsed.snapshot.lines.map(({ variantId, quantity }) => ({ variantId, quantity })),
    };
  } catch {
    return null;
  }
}
