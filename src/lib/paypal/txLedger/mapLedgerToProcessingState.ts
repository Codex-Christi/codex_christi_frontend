export type PayPalTxPaymentStatusResponse = {
  orderToken: string;
  status: string;
  lastEventType?: string | null;
  receiptLink?: string | null;
  receiptFile?: string | null;
  djangoPaymentSaveCustomId?: string | null;
  processingCompletedAt?: string | null;
  paidAmountLabel?: string | null;
  customerRecoveryStatus?: 'paid_unresolved' | null;
  recoveryReason?: string | null;
  updatedAt?: string | null;
  error?: { code?: string | null; message?: string | null } | null;
};

type ProcessingStep = {
  key: 'receiptUpload' | 'paymentSave' | 'orderPush';
  label: string;
  description: string;
  status: 'idle' | 'pending' | 'success' | 'error';
  errorMessage?: string;
};

type FlowStatus = 'idle' | 'processing' | 'completed' | 'error';

export type MappedProcessingState = {
  flowStatus: FlowStatus;
  steps: ProcessingStep[];
  receiptLink?: string;
  receiptFileName?: string;
  orderCustomId?: string;
  paidAmountLabel?: string;
  errorMessage?: string;
  supportReference: string;
  shortSupportReference: string;
  needsManualReview: boolean;
};

const createSteps = (): ProcessingStep[] => [
  {
    key: 'receiptUpload',
    label: 'Payment Recorded',
    description: 'Your transaction has been recorded in the payment ledger.',
    status: 'idle',
  },
  {
    key: 'paymentSave',
    label: 'Receipt Prepared',
    description: 'We are preparing your receipt and internal payment record.',
    status: 'idle',
  },
  {
    key: 'orderPush',
    label: 'Order Sent to Fulfillment',
    description: 'We are sending your confirmed purchase to fulfillment.',
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
  let steps = createSteps();
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

  if (isPaidUnresolved) {
    steps = withStepStatus(steps, 'receiptUpload', 'success');

    if (data.djangoPaymentSaveCustomId) {
      steps = withStepStatus(steps, 'paymentSave', 'success');
      steps = withStepStatus(steps, 'orderPush', 'error', message);
      return steps;
    }

    if (data.receiptLink && data.receiptFile) {
      steps = withStepStatus(steps, 'paymentSave', 'success');
      steps = withStepStatus(steps, 'orderPush', 'error', message);
      return steps;
    }

    steps = withStepStatus(steps, 'paymentSave', 'error', message);
    return steps;
  }

  if (data.djangoPaymentSaveCustomId) {
    steps = withStepStatus(steps, 'receiptUpload', 'success');
    steps = withStepStatus(steps, 'paymentSave', 'success');
    steps = withStepStatus(
      steps,
      'orderPush',
      'error',
      message,
    );
    return steps;
  }

  if (data.receiptLink && data.receiptFile) {
    steps = withStepStatus(steps, 'receiptUpload', 'success');
    steps = withStepStatus(steps, 'paymentSave', 'error', message);
    return steps;
  }

  steps = withStepStatus(steps, 'receiptUpload', 'error', message);
  return steps;
}

export function mapLedgerToProcessingState(
  data: PayPalTxPaymentStatusResponse,
): MappedProcessingState {
  const shared = {
    receiptLink: data.receiptLink ?? undefined,
    receiptFileName: data.receiptFile ?? undefined,
    orderCustomId: data.djangoPaymentSaveCustomId ?? undefined,
    paidAmountLabel: data.paidAmountLabel ?? undefined,
    errorMessage: data.error?.message ?? undefined,
    supportReference: data.orderToken,
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
    steps = withStepStatus(steps, 'paymentSave', 'pending');

    return {
      ...shared,
      flowStatus: 'processing',
      steps,
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

  let steps = createSteps();
  steps = withStepStatus(steps, 'receiptUpload', 'pending');

  return {
    ...shared,
    flowStatus: 'processing',
    steps,
  };
}
