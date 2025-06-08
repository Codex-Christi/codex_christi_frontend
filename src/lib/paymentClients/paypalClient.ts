// lib/paypalClient.ts
import { Client, Environment, LogLevel } from '@paypal/paypal-server-sdk';

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET } = process.env;

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  throw new Error(
    'Missing PayPal client ID or secret in environment variables'
  );
}

/**
 * PayPal client instance configured with credentials from environment variables.
 */

export const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: PAYPAL_CLIENT_ID,
    oAuthClientSecret: PAYPAL_CLIENT_SECRET,
  },
  timeout: 0,
  environment: Environment.Sandbox, // Use Environment.Live for production
  logging: {
    logLevel: LogLevel.Info,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true },
  },
});
