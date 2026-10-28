export type PaidCheckoutRecoverySummary = {
  orderToken: string;
  status: string;
  receiptLink: string | null;
  receiptFile: string | null;
  djangoPaymentSaveCustomId: string | null;
  supportReference: string;
  shortSupportReference: string;
  createdAt: string;
  updatedAt: string;
  placedAtLabel: string;
  paidAmountLabel: string | null;
  itemCount: number;
  itemSummaryLabel: string | null;
  itemTitles: string[];
  shippingSummaryLabel: string | null;
  statusLabel: string;
  message: string;
};
