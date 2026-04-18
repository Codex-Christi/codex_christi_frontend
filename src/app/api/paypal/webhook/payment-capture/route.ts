import { after } from 'next/server';

import { getServerPayPalConfig } from '@/lib/paypal/serverPayPalConfig';
import { runPostProcessing } from '@/lib/paypal/txLedger/runPostProcessing';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import {
  ensureWebhookDeliveryRecord,
  getWebhookPaypalOrderId,
  markWebhookFailed,
  markWebhookIgnored,
  markWebhookProcessed,
  markWebhookRetry,
  requiredHeader,
  type PayPalWebhookEvent,
  verifyWebhookSignature,
} from '@/lib/paypal/txLedger/webhookHelpers';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POST_CAPTURE_LEDGER_STATUSES = new Set<string>([
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
  PAYPAL_LEDGER_STATUS.COMPLETED,
]);

async function updateLedgerFromWebhook(args: {
  paypalOrderId: string;
  eventType: string;
  currentStatus: string;
}) {
  const { paypalOrderId, eventType, currentStatus } = args;

  switch (eventType) {
    case 'PAYMENT.AUTHORIZATION.CREATED':
      await paypalTxLedger.paypalIntent.update({
        where: { paypalOrderId },
        data: {
          status: PAYPAL_LEDGER_STATUS.AUTHORIZED,
          lastEventType: eventType,
        },
      });
      return;

    case 'PAYMENT.CAPTURE.PENDING':
      await paypalTxLedger.paypalIntent.update({
        where: { paypalOrderId },
        data: {
          status: PAYPAL_LEDGER_STATUS.PENDING,
          lastEventType: eventType,
        },
      });
      return;

    case 'PAYMENT.CAPTURE.DENIED':
      await paypalTxLedger.paypalIntent.update({
        where: { paypalOrderId },
        data: {
          status: PAYPAL_LEDGER_STATUS.ERROR,
          lastEventType: eventType,
          lastErrorCode: 'CAPTURE_DENIED',
          lastErrorMessage: 'PayPal capture denied',
        },
      });
      return;

    case 'PAYMENT.CAPTURE.REFUNDED':
      await paypalTxLedger.paypalIntent.update({
        where: { paypalOrderId },
        data: {
          status: PAYPAL_LEDGER_STATUS.REFUNDED,
          lastEventType: eventType,
        },
      });
      return;

    case 'PAYMENT.CAPTURE.COMPLETED':
      // Do not move the row backward if post-processing already advanced it.
      if (!POST_CAPTURE_LEDGER_STATUSES.has(currentStatus)) {
        await paypalTxLedger.paypalIntent.update({
          where: { paypalOrderId },
          data: {
            status: PAYPAL_LEDGER_STATUS.CAPTURED,
            lastEventType: eventType,
          },
        });
      }
      return;

    default:
      return;
  }
}

export async function POST(req: Request) {
  let eventId: string | undefined;

  try {
    const config = getServerPayPalConfig();
    const shouldVerify =
      (process.env.PAYPAL_WEBHOOK_VERIFY ??
        (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true';

    const raw = await req.text();
    const event = JSON.parse(raw) as PayPalWebhookEvent;
    eventId = event.id;

    if (shouldVerify) {
      if (!config.webhookId) {
        throw new Error('Missing PayPal webhook ID for the selected environment.');
      }

      const ok = await verifyWebhookSignature({
        event,
        webhookId: config.webhookId,
        paypalAuthAlgo: requiredHeader(req, 'paypal-auth-algo'),
        paypalCertUrl: requiredHeader(req, 'paypal-cert-url'),
        paypalTransmissionId: requiredHeader(req, 'paypal-transmission-id'),
        paypalTransmissionSig: requiredHeader(req, 'paypal-transmission-sig'),
        paypalTransmissionTime: requiredHeader(req, 'paypal-transmission-time'),
      });

      if (!ok) {
        return new Response('Invalid signature', { status: 400 });
      }
    } else {
      console.warn('[PayPal Webhook] Signature verification skipped (dev/simulator mode).');
    }

    if (!event.id || !event.event_type) {
      return new Response('Missing event metadata', { status: 400 });
    }

    const paypalOrderId = getWebhookPaypalOrderId(event);
    const delivery = await ensureWebhookDeliveryRecord({
      eventId: event.id,
      eventType: event.event_type,
      paypalOrderId,
      payload: event,
    });

    if (delivery.processedAt) {
      return new Response('OK', { status: 200 });
    }

    if (!paypalOrderId) {
      await markWebhookIgnored(event.id, 'No correlatable PayPal order id in webhook payload');
      return new Response('OK', { status: 200 });
    }

    const row = await paypalTxLedger.paypalIntent.findUnique({
      where: { paypalOrderId },
    });

    // Ask PayPal to retry if the webhook beats ledger correlation.
    if (!row) {
      await markWebhookRetry(event.id, 'Ledger row not correlated yet');
      return new Response('Retry later', { status: 500 });
    }

    if (row.status === PAYPAL_LEDGER_STATUS.COMPLETED) {
      await markWebhookProcessed(event.id);
      return new Response('OK', { status: 200 });
    }

    await updateLedgerFromWebhook({
      paypalOrderId,
      eventType: event.event_type,
      currentStatus: row.status,
    });

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      // ACK fast so provider retries are driven by our DB state, not route latency.
      after(async () => {
        try {
          await runPostProcessing(row.orderToken);
          await markWebhookProcessed(event.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          await markWebhookFailed(event.id, message);
          console.error('[PayPal Webhook] post-processing failed', {
            eventId: event.id,
            orderToken: row.orderToken,
            error: message,
          });
        }
      });

      return new Response('OK', { status: 200 });
    }

    await markWebhookProcessed(event.id);
    return new Response('OK', { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (eventId) {
      try {
        await markWebhookFailed(eventId, message);
      } catch {
        // Do not hide the original webhook failure if the event record update also fails.
      }
    }

    console.error('[PayPal Webhook] handler failed', {
      eventId,
      error: message,
    });

    return new Response('Webhook error', { status: 500 });
  }
}
