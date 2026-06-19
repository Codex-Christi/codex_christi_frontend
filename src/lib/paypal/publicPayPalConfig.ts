export type PublicPayPalPaymentMode = 'sandbox' | 'live';

function getPublicPayPalPaymentMode(): PublicPayPalPaymentMode {
  const configured = (process.env.NEXT_PUBLIC_PAYPAL_PAYMENT_MODE ?? '').toLowerCase();

  if (configured === 'live') return 'live';
  if (configured === 'sandbox') return 'sandbox';

  throw new Error('Invalid NEXT_PUBLIC_PAYPAL_PAYMENT_MODE. Expected "sandbox" or "live".');
}

// Client code only needs the public PayPal client ID; keep that logic separate
// from the server-only secret and webhook configuration.
export function getPublicPayPalClientId() {
  const paymentMode = getPublicPayPalPaymentMode();
  const isLive = paymentMode === 'live';

  const clientId = isLive
    ? process.env.NEXT_PUBLIC_PAYPAL_LIVE_CLIENT_ID
    : process.env.NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID;

  if (!clientId) {
    throw new Error(`Missing NEXT_PUBLIC PayPal ${paymentMode} client ID.`);
  }

  return clientId;
}
