import type { CartPurchase } from '@/lib/cart/types';
import type { CustomerPostPurchaseStage } from './customerPostPurchaseStage';
import type { CustomerAddressCorrectionState } from './customerAddressCorrection';
import type { CustomerRecoveryRequestState } from './customerRecoveryRequestState';

const paymentProgressFields = [
  'paypalAuthorizationId',
  'authorizePayload',
  'capturePayload',
  'lastErrorCode',
  'lastErrorMessage',
  'receiptLink',
  'receiptFile',
  'djangoPaymentSaveCustomId',
  'djangoPaymentSaveResponsePayload',
  'merchizeFulfillmentRequestPayload',
  'merchizeFulfillmentResponsePayload',
  'merchizeFulfillmentProcessingId',
  'merchizeProviderOrderId',
  'merchizeProviderOrderCode',
  'fulfillmentAddressOverride',
  'fulfillmentAddressOverrideReason',
  'fulfillmentAddressOverriddenBy',
  'fulfillmentAddressOverriddenAt',
  'processingTriggerSource',
  'processingTriggerDetail',
  'processingTriggeredAt',
  'processingCompletedAt',
  'postProcessingLockId',
  'postProcessingLockedAt',
  'postProcessingLockExpiresAt',
] as const;

export type CustomerOrderStatusRow = {
  orderToken: string;
  status: string;
  retryCount?: number;
  lastEventType?: string | null;
  djangoPaymentSaveCustomId?: string | null;
  updatedAt?: Date | null;
  processingCompletedAt?: Date | null;
} & Partial<Record<(typeof paymentProgressFields)[number], unknown>>;

/** These values have already been checked by the status route, including the receipt reference. */
export type CustomerOrderStatusFields = {
  addressCorrection?: CustomerAddressCorrectionState | null;
  recoveryRequest?: CustomerRecoveryRequestState | null;
  status: string;
  receiptLink?: string | null;
  receiptFile?: string | null;
  paidAmountLabel?: string | null;
  cartPurchase?: CartPurchase | null;
  customerRecoveryStatus?: 'paid_unresolved' | null;
  recoveryReason?: string | null;
  postPurchaseStage?: CustomerPostPurchaseStage | null;
  fulfillmentOnHold?: boolean;
  fulfillmentCheckedAt?: Date | null;
  error?: { message?: string | null } | null;
};

export type CustomerOrderStatus = {
  addressCorrection?: CustomerAddressCorrectionState;
  recoveryRequest?: CustomerRecoveryRequestState;
  orderToken: string;
  status: string;
  receiptReady: boolean;
  paymentSaved: boolean;
  paymentProgressed: boolean;
  receiptLink: string | null;
  receiptFile: string | null;
  processingCompletedAt: string | null;
  paidAmountLabel: string | null;
  cartPurchase: CartPurchase | null;
  customerRecoveryStatus: 'paid_unresolved' | null;
  recoveryReason: string | null;
  postPurchaseStage: CustomerPostPurchaseStage | null;
  fulfillmentOnHold: boolean;
  fulfillmentCheckedAt: string | null;
  updatedAt: string | null;
  error: { message: string } | null;
};

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

function isoDate(value: Date | null | undefined) {
  return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

/** Progress or incomplete evidence blocks a separate checkout; it does not prove payment. */
function paymentHasProgressed(row: CustomerOrderStatusRow) {
  return (
    row.status !== 'intent_created' ||
    row.retryCount !== 0 ||
    (row.lastEventType != null && row.lastEventType !== 'CHECKOUT.ORDER.CREATED') ||
    paymentProgressFields.some((field) => row[field] != null)
  );
}

/** Build a fresh public response without spreading ledger rows or nested private properties. */
export function toCustomerOrderStatus(
  row: CustomerOrderStatusRow,
  fields: CustomerOrderStatusFields,
): CustomerOrderStatus {
  const receiptLink = hasText(fields.receiptLink) ? fields.receiptLink : null;
  const receiptFile = hasText(fields.receiptFile) ? fields.receiptFile : null;
  const paymentProgressed = paymentHasProgressed(row);
  return {
    orderToken: row.orderToken,
    // Older clients inferred an untouched intent from the fields now removed from this response.
    status: fields.status === 'intent_created' && paymentProgressed ? 'pending' : fields.status,
    receiptReady: Boolean(receiptLink && receiptFile),
    paymentSaved: hasText(row.djangoPaymentSaveCustomId),
    paymentProgressed,
    receiptLink,
    receiptFile,
    processingCompletedAt: isoDate(row.processingCompletedAt),
    paidAmountLabel: fields.paidAmountLabel ?? null,
    cartPurchase: fields.cartPurchase
      ? {
          orderId: fields.cartPurchase.orderId,
          lines: fields.cartPurchase.lines.map(({ variantId, quantity }) => ({
            variantId,
            quantity,
          })),
        }
      : null,
    customerRecoveryStatus: fields.customerRecoveryStatus ?? null,
    recoveryReason: fields.recoveryReason ?? null,
    postPurchaseStage: fields.postPurchaseStage ?? null,
    ...(fields.addressCorrection ? { addressCorrection: fields.addressCorrection } : {}),
    ...(fields.recoveryRequest ? { recoveryRequest: fields.recoveryRequest } : {}),
    fulfillmentOnHold: fields.fulfillmentOnHold === true,
    fulfillmentCheckedAt: isoDate(fields.fulfillmentCheckedAt),
    updatedAt: isoDate(row.updatedAt),
    error: hasText(fields.error?.message) ? { message: fields.error.message } : null,
  };
}
