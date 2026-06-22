import 'server-only';

export type PayPalPaymentMode = 'sandbox' | 'live';

function required(value: string | undefined, message: string) {
  if (!value) throw new Error(message);
  return value;
}

function getPayPalPaymentMode(): PayPalPaymentMode {
  const configured = required(
    process.env.PAYPAL_PAYMENT_MODE,
    'Missing PAYPAL_PAYMENT_MODE. Expected "sandbox" or "live".',
  ).toLowerCase();

  if (configured === 'live') return 'live';
  if (configured === 'sandbox') return 'sandbox';

  throw new Error('Invalid PAYPAL_PAYMENT_MODE. Expected "sandbox" or "live".');
}

function parseCsvValues(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueValues(values: Array<string | undefined>) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;

    seen.add(value);
    unique.push(value);
  }

  return unique;
}

function isProductionDeployment() {
  return process.env.NODE_ENV === 'production';
}

function getSandboxNgrokWebhookIds() {
  return [process.env.PAYPAL_SANDBOX_NGROK_WEBHOOK_ID];
}

function getPayPalWebhookIds(paymentMode: PayPalPaymentMode) {
  if (paymentMode === 'live') {
    return uniqueValues([
      process.env.PAYPAL_LIVE_PRODUCTION_WEBHOOK_ID,
      ...parseCsvValues(process.env.PAYPAL_LIVE_ADDITIONAL_WEBHOOK_IDS),
    ]);
  }

  if (isProductionDeployment()) {
    return uniqueValues([
      process.env.PAYPAL_SANDBOX_PRODUCTION_WEBHOOK_ID,
      ...getSandboxNgrokWebhookIds(),
      ...parseCsvValues(process.env.PAYPAL_SANDBOX_ADDITIONAL_WEBHOOK_IDS),
    ]);
  }

  return uniqueValues([
    ...getSandboxNgrokWebhookIds(),
    process.env.PAYPAL_SANDBOX_PRODUCTION_WEBHOOK_ID,
    ...parseCsvValues(process.env.PAYPAL_SANDBOX_ADDITIONAL_WEBHOOK_IDS),
  ]);
}

// Resolve all server-only PayPal values from one place so webhook verification,
// server SDK calls, and payment-mode switching cannot drift apart.
export function getServerPayPalConfig() {
  const paymentMode = getPayPalPaymentMode();
  const isLive = paymentMode === 'live';

  const clientId = isLive
    ? process.env.PAYPAL_LIVE_CLIENT_ID
    : process.env.PAYPAL_SANDBOX_CLIENT_ID;

  const clientSecret = isLive
    ? process.env.PAYPAL_LIVE_CLIENT_SECRET
    : process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
  const webhookIds = getPayPalWebhookIds(paymentMode);

  return {
    paymentMode,
    baseUrl: isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId: required(clientId, `Missing PayPal ${paymentMode} client ID.`),
    clientSecret: required(clientSecret, `Missing PayPal ${paymentMode} client secret.`),
    webhookId: webhookIds[0],
    webhookIds,
  };
}
