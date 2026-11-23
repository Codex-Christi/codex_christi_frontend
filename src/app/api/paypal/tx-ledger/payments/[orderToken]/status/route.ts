import { requireCheckoutAccess } from '@/lib/shop/checkout/serverAccess';
import { checkoutRequestFailure } from '@/lib/shop/checkout/serverRequest';
import { NextResponse } from 'next/server';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { getCanonicalPaymentProjectionState } from '@/lib/paypal/txLedger/canonicalPaymentProjectionState';
import { getCapturedCartPurchase } from '@/lib/cart/purchase';
import { receiptObjectKey, receiptDownloadPath } from '@/lib/shop/orderHistory/receiptReference';
import { toCustomerOrderStatus } from '@/lib/shop/checkout/customerOrderStatus';
import { getBuyerAddressCorrectionSetup } from '@/lib/shop/checkout/customerAddressCorrectionServer';
import { readCustomerFulfillmentHold } from '@/lib/shop/checkout/readCustomerFulfillmentHold';
import { isAcceptedDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/fulfillmentProcessResponse';

type PageProps = {
  params: Promise<{ orderToken: string }>;
};

const CUSTOMER_RECOVERY_GRACE_MS = 45_000;
const privateHeaders = { 'Cache-Control': 'private, no-store' };

const CUSTOMER_RECOVERY_LEDGER_STATUSES = new Set<string>([
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED,
  PAYPAL_LEDGER_STATUS.ERROR,
]);

function getPaidAmountLabel(capturePayload: unknown) {
  const completion = getPayPalCaptureCompletion(capturePayload);
  // A field labeled "Paid" must come from completed capture evidence, never an authorization,
  // pending capture, or the expected canonical order total.
  if (!completion.ok || !completion.amount) return null;

  const value = Number(completion.amount.value);
  if (!Number.isFinite(value)) {
    return `${completion.amount.currency} ${completion.amount.value}`;
  }

  try {
    return new Intl.NumberFormat('en', {
      currency: completion.amount.currency,
      style: 'currency',
    }).format(value);
  } catch {
    return `${completion.amount.currency} ${completion.amount.value}`;
  }
}

function getCustomerRecoveryReason(status: string) {
  if (status === PAYPAL_LEDGER_STATUS.CAPTURED) {
    return 'Your payment was received. Your receipt is taking longer than expected.';
  }

  if (status === PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED) {
    return 'Your payment is recorded. Your order needs a check before preparation can continue.';
  }

  if (status === PAYPAL_LEDGER_STATUS.PAYMENT_SAVED) {
    return 'Your payment is recorded. Your order needs a check before preparation can continue.';
  }

  if (
    status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED ||
    status === PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED ||
    status === PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED
  ) {
    return 'Your order needs a check before preparation can continue.';
  }

  return 'Your order is taking longer than expected. Keep your order reference for support.';
}

export async function GET(_req: Request, { params }: PageProps) {
  const { orderToken } = await params;

  const row = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: privateHeaders });
  }

  try {
    await requireCheckoutAccess(row);
  } catch (error) {
    return checkoutRequestFailure(error);
  }

  const paymentState = getCanonicalPaymentProjectionState(row);
  const { captureCompletion, paymentFailure } = paymentState;
  const unresolvedAgeMs = Date.now() - row.updatedAt.getTime();
  const isResolved =
    !paymentFailure &&
    (row.status === PAYPAL_LEDGER_STATUS.COMPLETED ||
      row.status === PAYPAL_LEDGER_STATUS.REFUNDED ||
      Boolean(row.processingCompletedAt));
  const isCustomerProtectionVisible =
    captureCompletion.ok &&
    !isResolved &&
    (Boolean(paymentFailure) ||
      (CUSTOMER_RECOVERY_LEDGER_STATUSES.has(row.status) &&
        unresolvedAgeMs >= CUSTOMER_RECOVERY_GRACE_MS));
  const effectiveStatus = paymentFailure ? PAYPAL_LEDGER_STATUS.ERROR : row.status;
  const recoveryReason = paymentFailure
    ? !captureCompletion.ok
      ? 'Your payment details need review before you can continue. Keep your order reference for support.'
      : paymentFailure.errorCode === 'PAYPAL_REVIEW_ADDRESS_CHANGED'
        ? 'Your payment was received, but the delivery address needs review before we can prepare the order.'
        : 'Your payment was received, but the amount needs review before we can prepare the order.'
    : getCustomerRecoveryReason(effectiveStatus);
  const receiptLink = receiptObjectKey(row) ? receiptDownloadPath(row.orderToken) : null;
  const holdCheckedAt =
    captureCompletion.ok &&
    paymentState.paymentSafeForPostProcessing &&
    row.status !== PAYPAL_LEDGER_STATUS.REFUNDED &&
    row.djangoPaymentSaveCustomId &&
    isAcceptedDjangoFulfillmentProcessResponse(row.merchizeFulfillmentResponsePayload)
      ? await readCustomerFulfillmentHold(row.orderToken, row.djangoPaymentSaveCustomId)
      : null;

  const addressCorrection = holdCheckedAt ? null : getBuyerAddressCorrectionSetup(row, paymentState)?.state;
  const waitingForAddress = captureCompletion.ok && !isResolved && !paymentFailure &&
    row.lastErrorCode === 'MERCHIZE_ADDRESS_VALIDATION_PENDING';
  const customerStatus = toCustomerOrderStatus(row, {
    addressCorrection,
    status: effectiveStatus,
    receiptLink,
    receiptFile: receiptLink ? 'Codex-Christi-receipt' : null,
    paidAmountLabel: getPaidAmountLabel(row.capturePayload),
    cartPurchase: getCapturedCartPurchase(row, paymentState),
    customerRecoveryStatus: isCustomerProtectionVisible ? 'paid_unresolved' : null,
    recoveryReason: waitingForAddress
      ? "We're checking your delivery address. No action is needed right now."
      : isCustomerProtectionVisible ? recoveryReason : null,
    fulfillmentOnHold: Boolean(holdCheckedAt),
    fulfillmentCheckedAt: holdCheckedAt,
    error: paymentFailure
      ? { message: recoveryReason }
      : row.lastErrorMessage
        ? {
            message:
              'Your payment or order needs review. Please keep your order reference and contact support.',
          }
        : null,
  });
  return NextResponse.json(customerStatus, { headers: privateHeaders });
}
