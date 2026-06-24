const PROCESSING_SOURCE_DISPLAY = {
  capture_route: { label: 'Capture route', tone: 'slate' },
  manual_admin: { label: 'Manual admin', tone: 'rose' },
  payment_reconciliation: { label: 'Reconciliation', tone: 'emerald' },
  recovery_scanner: { label: 'Recovery scanner', tone: 'amber' },
  webhook: { label: 'Webhook', tone: 'cyan' },
} as const;

export type PayPalLedgerProcessingSource = keyof typeof PROCESSING_SOURCE_DISPLAY;
export type PayPalLedgerSourceTone =
  (typeof PROCESSING_SOURCE_DISPLAY)[PayPalLedgerProcessingSource]['tone'];

export type PayPalLedgerWebhookSourceFields = {
  matchedWebhookBindingKey?: string | null;
  matchedWebhookLabel?: string | null;
  matchedWebhookSource?: string | null;
  webhookVerificationMode?: string | null;
};

export type PayPalLedgerProcessingSourceFields = {
  latestWebhookSourceLabel?: string | null;
  processingTriggerDetail?: string | null;
  processingTriggerSource?: string | null;
};

export type PayPalLedgerInferredSourceFields = {
  checkoutSurfaceLabel?: string | null;
  hasCapturePayload?: boolean;
  ledgerStatus?: string | null;
};

function humanizeSourceKey(value: string) {
  return value.replaceAll('_', ' ');
}

function isProcessingSource(value: string): value is PayPalLedgerProcessingSource {
  return value in PROCESSING_SOURCE_DISPLAY;
}

export function getPayPalLedgerWebhookSourceLabel(
  source: PayPalLedgerWebhookSourceFields,
  fallback = 'Webhook source not recorded',
) {
  if (source.matchedWebhookLabel) return source.matchedWebhookLabel;
  if (source.matchedWebhookBindingKey) return humanizeSourceKey(source.matchedWebhookBindingKey);
  if (source.matchedWebhookSource) return humanizeSourceKey(source.matchedWebhookSource);
  if (source.webhookVerificationMode === 'disabled') return 'Signature verification disabled';

  return fallback;
}

export function getPayPalLedgerRunnerSourceLabel(source: string | null | undefined) {
  if (!source) return 'Not recorded';
  if (source === 'payment_reconciliation') return 'Payment reconciliation';
  return isProcessingSource(source)
    ? PROCESSING_SOURCE_DISPLAY[source].label
    : humanizeSourceKey(source);
}

export function getPayPalLedgerProcessingSourceDisplay(
  source: PayPalLedgerProcessingSourceFields,
  fallback: { label: string; tone: PayPalLedgerSourceTone } = {
    label: 'Not recorded',
    tone: 'slate',
  },
): { label: string; tone: PayPalLedgerSourceTone } {
  if (source.processingTriggerSource === 'webhook') {
    const detail = source.processingTriggerDetail ?? source.latestWebhookSourceLabel;

    return {
      label: detail ? `Webhook · ${detail}` : 'Webhook',
      tone: 'cyan',
    };
  }

  if (source.processingTriggerSource && isProcessingSource(source.processingTriggerSource)) {
    return PROCESSING_SOURCE_DISPLAY[source.processingTriggerSource];
  }

  return source.latestWebhookSourceLabel
    ? { label: `Webhook · ${source.latestWebhookSourceLabel}`, tone: 'cyan' }
    : fallback;
}

function getCheckoutSurfaceLabel() {
  if (process.env.NODE_ENV !== 'production') return 'Local checkout';

  const shopUrl = process.env.NEXT_PUBLIC_SHOP_SITE_URL?.trim();
  if (!shopUrl) return 'Shop checkout';

  try {
    return `${new URL(shopUrl).hostname} checkout`;
  } catch {
    return 'Shop checkout';
  }
}

export function getPayPalLedgerInferredProcessingSourceDisplay({
  checkoutSurfaceLabel,
  hasCapturePayload,
  ledgerStatus,
}: PayPalLedgerInferredSourceFields): { label: string; tone: PayPalLedgerSourceTone } | null {
  if (checkoutSurfaceLabel) return { label: checkoutSurfaceLabel, tone: 'slate' };
  if (!hasCapturePayload) return null;

  if (
    ledgerStatus === 'captured' ||
    ledgerStatus === 'receipt_uploaded' ||
    ledgerStatus === 'payment_saved'
  ) {
    return {
      label: `${getCheckoutSurfaceLabel()} capture route`,
      tone: 'slate',
    };
  }

  return null;
}
