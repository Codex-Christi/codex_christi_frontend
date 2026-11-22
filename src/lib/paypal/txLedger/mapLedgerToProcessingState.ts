import type { CustomerOrderStatus } from '@/lib/shop/checkout/customerOrderStatus';

export type PayPalTxPaymentStatusResponse = Pick<CustomerOrderStatus, 'orderToken' | 'status'> &
  Partial<Omit<CustomerOrderStatus, 'orderToken' | 'status'>>;

type ProcessingStep = {
  key: 'receiptUpload' | 'paymentSave' | 'orderPush';
  label: string;
  status: 'idle' | 'pending' | 'success' | 'error';
  errorMessage?: string;
};

type FlowStatus = 'idle' | 'processing' | 'completed' | 'error';

export type MappedProcessingState = {
  flowStatus: FlowStatus;
  steps: ProcessingStep[];
  receiptLink?: string;
  receiptFileName?: string;
  updatedAt?: string;
  paidAmountLabel?: string;
  errorMessage?: string;
  supportReference: string;
  fulfillmentOnHold?: boolean;
  fulfillmentCheckedAt?: string;
  shortSupportReference: string;
  needsManualReview: boolean;
};

const createSteps = (): ProcessingStep[] => [
  {
    key: 'receiptUpload',
    label: 'Payment',
    status: 'idle',
  },
  {
    key: 'paymentSave',
    label: 'Receipt',
    status: 'idle',
  },
  {
    key: 'orderPush',
    label: 'Order confirmation',
    status: 'idle',
  },
];

function withStepStatus(
  steps: ProcessingStep[],
  key: ProcessingStep['key'],
  status: ProcessingStep['status'],
  errorMessage?: string,
) {
  return steps.map((step) => (step.key === key ? { ...step, status, errorMessage } : step));
}

function buildErrorSteps(data: PayPalTxPaymentStatusResponse) {
  const isPaidUnresolved = data.customerRecoveryStatus === 'paid_unresolved';
  const isFulfillmentReview =
    data.status === 'fulfillment_blocked' ||
    data.status === 'fulfillment_failed' ||
    data.status === 'fulfillment_attention_required';
  const message = isPaidUnresolved
    ? (data.recoveryReason ?? 'Post-payment processing needs review before fulfillment.')
    : isFulfillmentReview
      ? 'Our team is reviewing the fulfillment handoff before your order moves forward.'
      : (data.error?.message ?? 'Payment processing failed');

  const receiptReady = data.receiptReady ?? Boolean(data.receiptLink && data.receiptFile);
  const failedStepIndex = data.paymentSaved || receiptReady ? 2 : isPaidUnresolved ? 1 : 0;

  return createSteps().map((step, index): ProcessingStep => ({
    ...step,
    status: index < failedStepIndex ? 'success' : index === failedStepIndex ? 'error' : 'idle',
    ...(index === failedStepIndex ? { errorMessage: message } : {}),
  }));
}

export function mapLedgerToProcessingState(
  data: PayPalTxPaymentStatusResponse,
): MappedProcessingState {
  const shared = {
    receiptLink: data.receiptReady === false ? undefined : (data.receiptLink ?? undefined),
    receiptFileName: data.receiptReady === false ? undefined : (data.receiptFile ?? undefined),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    paidAmountLabel: data.paidAmountLabel ?? undefined,
    errorMessage: data.error?.message ?? undefined,
    supportReference: data.orderToken,
    fulfillmentOnHold: data.fulfillmentOnHold,
    fulfillmentCheckedAt: data.fulfillmentCheckedAt ?? undefined,
    shortSupportReference: data.orderToken.slice(0, 8),
    needsManualReview:
      data.customerRecoveryStatus === 'paid_unresolved' ||
      data.status === 'fulfillment_blocked' ||
      data.status === 'fulfillment_failed' ||
      data.status === 'fulfillment_attention_required',
  };

  if (data.status === 'completed') {
    return {
      ...shared,
      flowStatus: 'completed',
      steps: createSteps().map((step) => ({ ...step, status: 'success' })),
    };
  }

  if (data.status === 'not_found') {
    return {
      ...shared,
      flowStatus: 'idle',
      steps: createSteps(),
    };
  }

  if (
    data.customerRecoveryStatus === 'paid_unresolved' ||
    data.status === 'error' ||
    data.status === 'refunded' ||
    data.status === 'fulfillment_blocked' ||
    data.status === 'fulfillment_failed' ||
    data.status === 'fulfillment_attention_required' ||
    data.error?.message
  ) {
    return {
      ...shared,
      flowStatus: 'error',
      steps: buildErrorSteps(data),
    };
  }

  if (data.status === 'payment_saved') {
    let steps = createSteps();
    steps = withStepStatus(steps, 'receiptUpload', 'success');
    steps = withStepStatus(steps, 'paymentSave', 'success');
    steps = withStepStatus(steps, 'orderPush', 'pending');

    return {
      ...shared,
      flowStatus: 'processing',
      steps,
    };
  }

  if (data.status === 'receipt_uploaded') {
    let steps = createSteps();
    steps = withStepStatus(steps, 'receiptUpload', 'success');
    steps = withStepStatus(
      steps,
      'paymentSave',
      (data.receiptReady ?? Boolean(data.receiptLink && data.receiptFile)) ? 'success' : 'pending',
    );

    return {
      ...shared,
      flowStatus: 'processing',
      steps,
    };
  }

  let steps = createSteps();
  steps = withStepStatus(steps, 'receiptUpload', 'pending');

  return {
    ...shared,
    flowStatus: 'processing',
    steps,
  };
}
