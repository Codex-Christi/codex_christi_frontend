import 'server-only';

import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { normalizeRecoveryEmail } from './recoveryOtpUtils';

const UNRESOLVED_PAID_STATUSES = [
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
  PAYPAL_LEDGER_STATUS.ERROR,
] as const;

export async function findUnresolvedPaidCheckoutsByEmail(email: string) {
  const normalizedEmail = normalizeRecoveryEmail(email);

  return paypalTxLedger.paypalIntent.findMany({
    where: {
      customerEmail: normalizedEmail,
      processingCompletedAt: null,
      status: {
        in: [...UNRESOLVED_PAID_STATUSES],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 3,
  });
}
