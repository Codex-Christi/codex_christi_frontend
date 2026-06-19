// lib/paypalClient.ts
import { Client, Environment, LogLevel } from '@paypal/paypal-server-sdk';
import { getServerPayPalConfig } from '@/lib/paypal/serverPayPalConfig';

/**
 * PayPal client configured with credentials from environment variables.
 *
 * Keep config resolution lazy. Next imports API modules during production builds,
 * and runtime-only env files are not necessarily available in the image build stage.
 */
let cachedClient: Client | null = null;
let cachedClientKey: string | null = null;

export function getPayPalClient() {
  const config = getServerPayPalConfig();
  const clientKey = `${config.paymentMode}:${config.clientId}:${config.clientSecret}`;

  if (cachedClient && cachedClientKey === clientKey) {
    return cachedClient;
  }

  cachedClient = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
    },
    timeout: 0,
    environment: config.paymentMode === 'live' ? Environment.Production : Environment.Sandbox,
    logging: {
      logLevel: LogLevel.Debug,
      logRequest: { logBody: true },
      logResponse: { logHeaders: true },
    },
  });
  cachedClientKey = clientKey;

  return cachedClient;
}
