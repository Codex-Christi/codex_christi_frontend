export type PublicPayPalEnvironment = 'sandbox' | 'live';

function getPublicPayPalEnvironment(): PublicPayPalEnvironment {
  const configured = (process.env.NEXT_PUBLIC_PAYPAL_ENV ?? '').toLowerCase();

  if (configured === 'live') return 'live';
  if (configured === 'sandbox') return 'sandbox';

  return process.env.NODE_ENV === 'production' ? 'live' : 'sandbox';
}

// Client code only needs the public PayPal client ID; keep that logic separate
// from the server-only secret and webhook configuration.
export function getPublicPayPalClientId() {
  const isLive = getPublicPayPalEnvironment() === 'live';

  const clientId = isLive
    ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_LIVE ?? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
    : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX ??
      process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  if (!clientId) {
    throw new Error('Missing NEXT_PUBLIC PayPal client ID for the selected environment.');
  }

  return clientId;
}
