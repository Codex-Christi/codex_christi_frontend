import 'server-only';

import { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { getServerPayPalConfig } from '@/lib/paypal/serverPayPalConfig';

export type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource?: {
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
    custom_id?: string;
    invoice_id?: string;
  };
};

export function requiredHeader(req: Request, name: string) {
  const value = req.headers.get(name);
  if (!value) throw new Error(`Missing header: ${name}`);
  return value;
}

// PayPal webhook payloads are not fully uniform, so keep order correlation fallbacks here.
export function getWebhookPaypalOrderId(event: PayPalWebhookEvent): string | undefined {
  return (
    event.resource?.supplementary_data?.related_ids?.order_id ||
    event.resource?.custom_id ||
    event.resource?.invoice_id ||
    undefined
  );
}

async function getPayPalAccessToken() {
  const config = getServerPayPalConfig();
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`PayPal token error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return { baseUrl: config.baseUrl, accessToken: data.access_token as string };
}

export async function verifyWebhookSignature(args: {
  event: PayPalWebhookEvent;
  webhookId: string;
  paypalAuthAlgo: string;
  paypalCertUrl: string;
  paypalTransmissionId: string;
  paypalTransmissionSig: string;
  paypalTransmissionTime: string;
}) {
  const { baseUrl, accessToken } = await getPayPalAccessToken();

  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: args.paypalAuthAlgo,
      cert_url: args.paypalCertUrl,
      transmission_id: args.paypalTransmissionId,
      transmission_sig: args.paypalTransmissionSig,
      transmission_time: args.paypalTransmissionTime,
      webhook_id: args.webhookId,
      webhook_event: args.event,
    }),
  });

  if (!response.ok) {
    throw new Error(`Verify signature error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.verification_status === 'SUCCESS';
}

export async function ensureWebhookDeliveryRecord(args: {
  eventId: string;
  eventType: string;
  paypalOrderId?: string;
  payload: unknown;
}) {
  const existing = await paypalTxLedger.paypalWebhookEvent.findUnique({
    where: { eventId: args.eventId },
  });

  if (existing) return existing;

  return paypalTxLedger.paypalWebhookEvent.create({
    data: {
      eventId: args.eventId,
      eventType: args.eventType,
      paypalOrderId: args.paypalOrderId ?? null,
      payload: args.payload as Prisma.InputJsonValue,
      processingStatus: 'received',
    },
  });
}

async function updateWebhookEvent(
  eventId: string,
  data: Parameters<typeof paypalTxLedger.paypalWebhookEvent.update>[0]['data'],
) {
  await paypalTxLedger.paypalWebhookEvent.update({
    where: { eventId },
    data,
  });
}

export async function markWebhookProcessed(eventId: string) {
  await updateWebhookEvent(eventId, {
    processingStatus: 'processed',
    processedAt: new Date(),
    lastAttemptAt: new Date(),
    attemptCount: { increment: 1 },
    lastErrorMessage: null,
  });
}

export async function markWebhookIgnored(eventId: string, reason?: string) {
  await updateWebhookEvent(eventId, {
    processingStatus: 'ignored',
    processedAt: new Date(),
    lastAttemptAt: new Date(),
    attemptCount: { increment: 1 },
    lastErrorMessage: reason ?? null,
  });
}

export async function markWebhookRetry(eventId: string, message: string) {
  await updateWebhookEvent(eventId, {
    processingStatus: 'awaiting_retry',
    lastAttemptAt: new Date(),
    attemptCount: { increment: 1 },
    lastErrorMessage: message,
  });
}

export async function markWebhookFailed(eventId: string, message: string) {
  await updateWebhookEvent(eventId, {
    processingStatus: 'failed',
    lastAttemptAt: new Date(),
    attemptCount: { increment: 1 },
    lastErrorMessage: message,
  });
}
