import 'server-only';

export type PayPalRuntimeEnvironment = 'sandbox' | 'live';

function required(value: string | undefined, message: string) {
  if (!value) throw new Error(message);
  return value;
}

function getPayPalEnvironment(): PayPalRuntimeEnvironment {
  const configured = (process.env.PAYPAL_ENV ?? '').toLowerCase();

  if (configured === 'live') return 'live';
  if (configured === 'sandbox') return 'sandbox';

  return process.env.NODE_ENV === 'production' ? 'live' : 'sandbox';
}

// Resolve all server-only PayPal values from one place so webhook verification,
// server SDK calls, and environment switching cannot drift apart.
export function getServerPayPalConfig() {
  const environment = getPayPalEnvironment();
  const isLive = environment === 'live';

  const clientId = isLive
    ? process.env.PAYPAL_CLIENT_ID_LIVE ??
      process.env.PAYPAL_CLIENT_ID
    : process.env.PAYPAL_CLIENT_ID_SANDBOX ??
      process.env.PAYPAL_CLIENT_ID;

  const clientSecret = isLive
    ? process.env.PAYPAL_CLIENT_SECRET_LIVE ?? process.env.PAYPAL_CLIENT_SECRET
    : process.env.PAYPAL_CLIENT_SECRET_SANDBOX ?? process.env.PAYPAL_CLIENT_SECRET;

  return {
    environment,
    baseUrl: isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId: required(clientId, 'Missing PayPal client ID for the selected environment.'),
    clientSecret: required(
      clientSecret,
      'Missing PayPal client secret for the selected environment.',
    ),
    webhookId: isLive
      ? process.env.PAYPAL_WEBHOOK_ID_LIVE ?? process.env.PAYPAL_WEBHOOK_ID
      : process.env.PAYPAL_WEBHOOK_ID_SANDBOX ?? process.env.PAYPAL_WEBHOOK_ID,
  };
}
