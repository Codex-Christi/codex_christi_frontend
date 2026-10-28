import 'server-only';

import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { isCompletedPayPalCapture } from '@/lib/paypal/txLedger/captureCompletion';
import { normalizeRecoveryEmail } from './recoveryOtpUtils';
import { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';

const UNRESOLVED_PAID_STATUSES = [
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED,
  PAYPAL_LEDGER_STATUS.ERROR,
] as const;

const RECOVERY_LEDGER_ROW_SELECT = {
  id: true,
  orderToken: true,
  userId: true,
  customerEmail: true,
  status: true,
  cartSnapshot: true,
  shippingSnapshot: true,
  canonicalOrderSnapshot: true,
  canonicalOrderSnapshotVersion: true,
  canonicalOrderSnapshotHash: true,
  authorizePayload: true,
  capturePayload: true,
  receiptLink: true,
  receiptFile: true,
  djangoPaymentSaveCustomId: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaypalIntentSelect;
type RecoveryLedgerRow = Prisma.PaypalIntentGetPayload<{
  select: typeof RECOVERY_LEDGER_ROW_SELECT;
}>;
const RECOVERY_SCAN_PAGE_SIZE = 10;

/** Read payment truth directly: a stale/missing queue projection must not decide customer access. */
export async function findUnresolvedPaidCheckoutsByEmail(email: string) {
  const normalizedEmail = normalizeRecoveryEmail(email);
  const paid: RecoveryLedgerRow[] = [];
  let cursor: { id: string } | undefined;

  for (;;) {
    const rows = await paypalTxLedger.paypalIntent.findMany({
      where: {
        customerEmail: normalizedEmail,
        processingCompletedAt: null,
        capturePayload: {
          not: Prisma.AnyNull,
        },
        djangoOrderIntentOrderId: {
          not: null,
        },
        djangoOrderIntentVerifyPayload: {
          not: Prisma.AnyNull,
        },
        status: {
          in: [...UNRESOLVED_PAID_STATUSES],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: RECOVERY_SCAN_PAGE_SIZE,
      ...(cursor ? { cursor, skip: 1 } : {}),
      select: RECOVERY_LEDGER_ROW_SELECT,
    });

    for (const row of rows) {
      if (isCompletedPayPalCapture(row.capturePayload)) paid.push(row);
      if (paid.length === 3) return paid;
    }
    if (rows.length < RECOVERY_SCAN_PAGE_SIZE) return paid;
    cursor = { id: rows[rows.length - 1].id };
  }
}
