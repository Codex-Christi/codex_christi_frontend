export const PAYPAL_LEDGER_STATUS = {
  INTENT_CREATING: 'intent_creating',
  INTENT_CREATED: 'intent_created',
  AUTHORIZED: 'authorized',
  CAPTURED: 'captured',
  RECEIPT_UPLOADED: 'receipt_uploaded',
  PAYMENT_SAVED: 'payment_saved',
  FULFILLMENT_BLOCKED: 'fulfillment_blocked',
  FULFILLMENT_FAILED: 'fulfillment_failed',
  COMPLETED: 'completed',
  PENDING: 'pending',
  REFUNDED: 'refunded',
  ERROR: 'error',
} as const;

export type PayPalLedgerStatus = (typeof PAYPAL_LEDGER_STATUS)[keyof typeof PAYPAL_LEDGER_STATUS];
