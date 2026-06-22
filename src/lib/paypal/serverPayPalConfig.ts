import 'server-only';

import {
  getConfiguredPayPalPaymentMode,
  getEnvPayPalLedgerWebhookIds,
  type PayPalPaymentMode,
} from '@/lib/paypal/ledgerWebhookConfig';

export type { PayPalPaymentMode };

function required(value: string | undefined, message: string) {
  if (!value) throw new Error(message);
  return value;
}

// Resolve all server-only PayPal values from one place so webhook verification,
// server SDK calls, and payment-mode switching cannot drift apart.
export function getServerPayPalConfig() {
  const paymentMode = getConfiguredPayPalPaymentMode();
  const isLive = paymentMode === 'live';

  const clientId = isLive
    ? process.env.PAYPAL_LIVE_CLIENT_ID
    : process.env.PAYPAL_SANDBOX_CLIENT_ID;

  const clientSecret = isLive
    ? process.env.PAYPAL_LIVE_CLIENT_SECRET
    : process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
  const webhookIds = getEnvPayPalLedgerWebhookIds(paymentMode);

  return {
    paymentMode,
    baseUrl: isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId: required(clientId, `Missing PayPal ${paymentMode} client ID.`),
    clientSecret: required(clientSecret, `Missing PayPal ${paymentMode} client secret.`),
    webhookId: webhookIds[0],
    webhookIds,
  };
}
