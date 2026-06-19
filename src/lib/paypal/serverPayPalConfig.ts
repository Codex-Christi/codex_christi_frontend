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

  return {
    paymentMode,
    baseUrl: isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId: required(clientId, `Missing PayPal ${paymentMode} client ID.`),
    clientSecret: required(clientSecret, `Missing PayPal ${paymentMode} client secret.`),
    webhookId: isLive ? process.env.PAYPAL_LIVE_WEBHOOK_ID : process.env.PAYPAL_SANDBOX_WEBHOOK_ID,
  };
}
