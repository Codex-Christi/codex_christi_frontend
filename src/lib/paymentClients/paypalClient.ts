// lib/paypalClient.ts
import { Client, Environment, LogLevel } from '@paypal/paypal-server-sdk';

/**
 * PayPal client instance configured with credentials from environment variables.
 */

export const paypalClient = new Client({
  clientCredentialsAuthCredentials: {
    oAuthClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    oAuthClientSecret: process.env.PAYPAL_CLIENT_SECRET!,
  },
  timeout: 0,
  environment: Environment.Sandbox, // Use Environment.Live for production
  logging: {
    logLevel: LogLevel.Debug,
    logRequest: { logBody: true },
    logResponse: { logHeaders: true },
  },
});
