export type PayPalTxPaymentStatusResponse = {
  orderToken: string;
  status: string;
  lastEventType?: string | null;
  receiptLink?: string | null;
  receiptFile?: string | null;
  backendCustomId?: string | null;
  processingCompletedAt?: string | null;
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
  errorMessage?: string;
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
  const message = data.error?.message ?? 'Payment processing failed';

  if (data.backendCustomId) {
    steps = withStepStatus(steps, 'receiptUpload', 'success');
    steps = withStepStatus(steps, 'paymentSave', 'success');
    steps = withStepStatus(steps, 'orderPush', 'error', message);
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
    orderCustomId: data.backendCustomId ?? undefined,
    errorMessage: data.error?.message ?? undefined,
  };

  if (data.status === 'completed') {
    return {
      ...shared,
      flowStatus: 'completed',
      steps: createSteps().map((step) => ({ ...step, status: 'success' })),
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

  if (data.status === 'error' || data.status === 'refunded') {
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
