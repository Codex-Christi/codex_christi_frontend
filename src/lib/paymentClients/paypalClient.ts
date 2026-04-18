// lib/paypalClient.ts
import { Client, Environment, LogLevel } from '@paypal/paypal-server-sdk';
import { getServerPayPalConfig } from '@/lib/paypal/serverPayPalConfig';

/**
 * PayPal client instance configured with credentials from environment variables.
 */

const config = getServerPayPalConfig();

export const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: config.clientId,
    oAuthClientSecret: config.clientSecret,
  },
  timeout: 0,
  environment: config.environment === 'live' ? Environment.Production : Environment.Sandbox,
  logging: {
    logLevel: LogLevel.Debug,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true },
  },
});
