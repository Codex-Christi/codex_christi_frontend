type JsonRecord = Record<string, unknown>;

export type PayPalCaptureCompletion = {
  ok: boolean;
  status: string | null;
  captureId: string | null;
  amount: {
    value: string;
    currency: string;
  } | null;
  finalCapture: boolean | null;
  reason: string;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function getPath(root: unknown, path: Array<string | number>) {
  return path.reduce<unknown>((current, key) => {
    if (typeof key === 'number') return Array.isArray(current) ? current[key] : undefined;
    return asRecord(current)?.[key];
  }, root);
}

function getNestedCapture(payload: unknown) {
  const capturePaths = [
    ['purchaseUnits', 0, 'payments', 'captures', 0],
    ['purchase_units', 0, 'payments', 'captures', 0],
  ];

  for (const path of capturePaths) {
    const capture = asRecord(getPath(payload, path));
    if (capture) return capture;
  }

  return null;
}

function getCaptureRecord(payload: unknown) {
  return getNestedCapture(payload) ?? asRecord(payload);
}

function getCaptureAmount(capture: JsonRecord | null) {
  if (!capture) return null;

  const amountPaths = [
    ['amount'],
    ['sellerReceivableBreakdown', 'grossAmount'],
    ['seller_receivable_breakdown', 'gross_amount'],
  ];

  for (const path of amountPaths) {
    const amount = asRecord(getPath(capture, path));
    const value = asString(amount?.value);
    const currency = asString(amount?.currencyCode) ?? asString(amount?.currency_code);

    if (value && currency) return { value, currency };
  }

  return null;
}

export function getPayPalCaptureCompletion(payload: unknown): PayPalCaptureCompletion {
  const capture = getCaptureRecord(payload);

  if (!capture) {
    return {
      ok: false,
      status: null,
      captureId: null,
      amount: null,
      finalCapture: null,
      reason: 'PayPal capture payload is missing.',
    };
  }

  const status = asString(capture.status)?.toUpperCase() ?? null;
  const captureId = asString(capture.id);
  const amount = getCaptureAmount(capture);
  const finalCapture = asBoolean(capture.finalCapture) ?? asBoolean(capture.final_capture) ?? null;

  if (status !== 'COMPLETED') {
    return {
      ok: false,
      status,
      captureId,
      amount,
      finalCapture,
      reason: status
        ? `PayPal capture status is ${status}, not COMPLETED.`
        : 'PayPal capture status is missing.',
    };
  }

  if (!captureId) {
    return {
      ok: false,
      status,
      captureId,
      amount,
      finalCapture,
      reason: 'PayPal capture ID is missing.',
    };
  }

  if (!amount) {
    return {
      ok: false,
      status,
      captureId,
      amount,
      finalCapture,
      reason: 'PayPal capture amount is missing.',
    };
  }

  if (finalCapture === false) {
    return {
      ok: false,
      status,
      captureId,
      amount,
      finalCapture,
      reason: 'PayPal capture is not final.',
    };
  }

  return {
    ok: true,
    status,
    captureId,
    amount,
    finalCapture,
    reason: `PayPal capture ${captureId} is COMPLETED.`,
  };
}

export function isCompletedPayPalCapture(payload: unknown) {
  return getPayPalCaptureCompletion(payload).ok;
}
