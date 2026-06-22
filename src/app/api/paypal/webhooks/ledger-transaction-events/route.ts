import { after } from 'next/server';

import { resolvePayPalLedgerTrustedWebhookIds } from '@/lib/paypal/ledgerWebhookTrust';
import { getServerPayPalConfig } from '@/lib/paypal/serverPayPalConfig';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import { runPaidFulfillmentProcessing } from '@/lib/paypal/txLedger/runPaidFulfillmentProcessing';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import {
  ensureWebhookDeliveryRecord,
  getWebhookLedgerCorrelation,
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
  PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED,
  PAYPAL_LEDGER_STATUS.COMPLETED,
]);

const FULFILLMENT_RECOVERY_STATUSES = new Set<string>([
  PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
]);

type PayPalWebhookVerificationHeaders = {
  paypalAuthAlgo: string;
  paypalCertUrl: string;
  paypalTransmissionId: string;
  paypalTransmissionSig: string;
  paypalTransmissionTime: string;
};

function shouldVerifyWebhookSignature() {
  const configured = (process.env.PAYPAL_WEBHOOK_SIGNATURE_VERIFICATION ?? '').toLowerCase();

  if (configured === 'required') return true;
  if (configured === 'disabled') return false;

  throw new Error(
    'Invalid PAYPAL_WEBHOOK_SIGNATURE_VERIFICATION. Expected "required" or "disabled".',
  );
}

async function verifyWebhookSignatureWithAnyConfiguredWebhookId({
  event,
  webhookIds,
  headers,
}: {
  event: PayPalWebhookEvent;
  webhookIds: string[];
  headers: PayPalWebhookVerificationHeaders;
}) {
  for (const webhookId of webhookIds) {
    try {
      const ok = await verifyWebhookSignature({
        event,
        webhookId,
        ...headers,
      });

      if (ok) return true;
    } catch (error) {
      console.warn('[PayPal Webhook] signature verification failed for configured webhook ID', {
        webhookId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return false;
}

async function updateLedgerFromWebhook(args: {
  orderToken: string;
  eventType: string;
  currentStatus: string;
  currentCapturePayload: unknown;
  webhookResource: unknown;
}) {
  const { orderToken, eventType, currentStatus, currentCapturePayload, webhookResource } = args;

  switch (eventType) {
    case 'PAYMENT.AUTHORIZATION.CREATED':
      await paypalTxLedger.paypalIntent.update({
        where: { orderToken },
        data: {
          status: PAYPAL_LEDGER_STATUS.AUTHORIZED,
          lastEventType: eventType,
        },
      });
      return;

    case 'PAYMENT.CAPTURE.PENDING':
      await paypalTxLedger.paypalIntent.update({
        where: { orderToken },
        data: {
          status: PAYPAL_LEDGER_STATUS.PENDING,
          lastEventType: eventType,
        },
      });
      return;

    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.DECLINED':
      await paypalTxLedger.paypalIntent.update({
        where: { orderToken },
        data: {
          status: PAYPAL_LEDGER_STATUS.ERROR,
          lastEventType: eventType,
          lastErrorCode: 'CAPTURE_DECLINED',
          lastErrorMessage: 'PayPal capture declined',
        },
      });
      return;

    case 'PAYMENT.CAPTURE.REFUNDED':
      await paypalTxLedger.paypalIntent.update({
        where: { orderToken },
        data: {
          status: PAYPAL_LEDGER_STATUS.REFUNDED,
          lastEventType: eventType,
        },
      });
      return;

    case 'PAYMENT.CAPTURE.COMPLETED': {
      const currentCaptureCompletion = getPayPalCaptureCompletion(currentCapturePayload);
      const webhookCaptureCompletion = getPayPalCaptureCompletion(webhookResource);
      const completedCapturePayload = currentCaptureCompletion.ok
        ? undefined
        : webhookCaptureCompletion.ok
          ? JSON.parse(JSON.stringify(webhookResource))
          : undefined;

      if (!currentCaptureCompletion.ok && !webhookCaptureCompletion.ok) {
        await paypalTxLedger.paypalIntent.update({
          where: { orderToken },
          data: {
            status: PAYPAL_LEDGER_STATUS.ERROR,
            lastEventType: eventType,
            lastErrorCode: 'CAPTURE_NOT_COMPLETED',
            lastErrorMessage: webhookCaptureCompletion.reason,
          },
        });
        return;
      }

      // Do not move the row backward if post-processing already advanced it.
      if (!POST_CAPTURE_LEDGER_STATUSES.has(currentStatus)) {
        await paypalTxLedger.paypalIntent.update({
          where: { orderToken },
          data: {
            status: PAYPAL_LEDGER_STATUS.CAPTURED,
            capturePayload: completedCapturePayload,
            lastEventType: eventType,
          },
        });
      } else if (completedCapturePayload) {
        await paypalTxLedger.paypalIntent.update({
          where: { orderToken },
          data: {
            capturePayload: completedCapturePayload,
            lastEventType: eventType,
          },
        });
      } else {
        await paypalTxLedger.paypalIntent.update({
          where: { orderToken },
          data: {
            lastEventType: eventType,
          },
        });
      }
      return;
    }

    default:
      return;
  }
}

export async function POST(req: Request) {
  let eventId: string | undefined;

  try {
    const config = getServerPayPalConfig();
    const trustResolution = await resolvePayPalLedgerTrustedWebhookIds(config.paymentMode);
    const shouldVerify = shouldVerifyWebhookSignature();

    const raw = await req.text();
    const event = JSON.parse(raw) as PayPalWebhookEvent;
    eventId = event.id;

    if (shouldVerify) {
      if (!trustResolution.webhookIds.length) {
        throw new Error('Missing PayPal webhook ID(s) for the selected payment mode.');
      }

      const ok = await verifyWebhookSignatureWithAnyConfiguredWebhookId({
        event,
        webhookIds: trustResolution.webhookIds,
        headers: {
          paypalAuthAlgo: requiredHeader(req, 'paypal-auth-algo'),
          paypalCertUrl: requiredHeader(req, 'paypal-cert-url'),
          paypalTransmissionId: requiredHeader(req, 'paypal-transmission-id'),
          paypalTransmissionSig: requiredHeader(req, 'paypal-transmission-sig'),
          paypalTransmissionTime: requiredHeader(req, 'paypal-transmission-time'),
        },
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

    const correlation = getWebhookLedgerCorrelation(event);

    const delivery = await ensureWebhookDeliveryRecord({
      eventId: event.id,
      eventType: event.event_type,
      paypalOrderId:
        correlation?.source === 'paypal_order_id' ? correlation.paypalOrderId : undefined,
      payload: event,
    });

    if (delivery.processedAt) {
      return new Response('OK', { status: 200 });
    }

    if (!correlation) {
      await markWebhookIgnored(
        event.id,
        'No correlatable PayPal order ID or order token in webhook payload',
      );
      return new Response('OK', { status: 200 });
    }

    const row = await paypalTxLedger.paypalIntent.findUnique({
      where:
        correlation.source === 'paypal_order_id'
          ? { paypalOrderId: correlation.paypalOrderId }
          : { orderToken: correlation.orderToken },
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
      orderToken: row.orderToken,
      eventType: event.event_type,
      currentStatus: row.status,
      currentCapturePayload: row.capturePayload,
      webhookResource: event.resource,
    });

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      if (FULFILLMENT_RECOVERY_STATUSES.has(row.status)) {
        await markWebhookProcessed(event.id);
        return new Response('OK', { status: 200 });
      }

      // ACK fast so provider retries are driven by our DB state, not route latency.
      after(async () => {
        try {
          await runPaidFulfillmentProcessing(row.orderToken);
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
