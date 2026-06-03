type RecoveryLedgerRow = {
  orderToken: string;
  status: string;
  receiptLink: string | null;
  receiptFile: string | null;
  djangoPaymentSaveCustomId: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function mapRecoveryCheckoutSummary(row: RecoveryLedgerRow) {
  return {
    orderToken: row.orderToken,
    status: row.status,
    receiptLink: row.receiptLink,
    receiptFile: row.receiptFile,
    djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
    supportReference: row.orderToken,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    message:
      row.lastErrorMessage || row.status === 'error'
        ? 'Your payment was received, but fulfillment needs review.'
        : 'Your payment was received and is still being processed.',
  };
}
