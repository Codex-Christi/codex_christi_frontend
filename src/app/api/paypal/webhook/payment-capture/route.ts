// app/api/paypal/webhook/route.ts
export const runtime = 'nodejs'; // keep server-side
export const dynamic = 'force-dynamic';

type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource_type: string;
  event_version: string;
  summary: string;
  resource: {
    id: string;
    create_time: string;
    update_time?: string;
    state?: string;
    amount?: {
      total: string;
      currency: string;
      details: {
        subtotal: string;
      };
    };
    parent_payment?: string;
    valid_until?: string;
    links?: Array<{
      href: string;
      rel: string;
      method: string;
    }>;
  };
  links?: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
};

function requiredHeader(req: Request, name: string) {
  const v = req.headers.get(name);
  if (!v) throw new Error(`Missing header: ${name}`);
  return v;
}

async function getPayPalAccessToken() {
  const env = process.env.PAYPAL_ENV ?? 'sandbox';
  const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  if (!clientId || !secret) throw new Error('Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`PayPal token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { base, accessToken: data.access_token as string };
}

async function verifyWebhookSignature(args: {
  event: PayPalWebhookEvent;
  webhookId: string;
  paypalAuthAlgo: string;
  paypalCertUrl: string;
  paypalTransmissionId: string;
  paypalTransmissionSig: string;
  paypalTransmissionTime: string;
}) {
  const { base, accessToken } = await getPayPalAccessToken();

  // Fields required by PayPal for verification:
  // auth_algo, cert_url, transmission_id, transmission_sig, transmission_time, webhook_id, webhook_event  [oai_citation:9‡docs.paypal.ai](https://docs.paypal.ai/reference/api/rest/verify-webhook-signature/verify-webhook-signature)
  const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
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

  if (!res.ok) throw new Error(`Verify signature error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.verification_status === 'SUCCESS';
}

export async function POST(req: Request) {
  try {
    // Signature verification toggle:
    // - Defaults to ON in production and OFF in development.
    // - The PayPal Webhook Simulator sends mock events that are not verifiable.
    // - For real sandbox/live webhooks, set PAYPAL_WEBHOOK_VERIFY=true and provide PAYPAL_WEBHOOK_ID.
    const shouldVerify =
      (process.env.PAYPAL_WEBHOOK_VERIFY ??
        (process.env.NODE_ENV === 'production' ? 'true' : 'false')) === 'true';

    // This is the ID of the webhook subscription you created for this app/environment.
    // (Sandbox and Live each have their own webhook IDs.)
    const webhookId = process.env.PAYPAL_WEBHOOK_ID ?? '';

    // Read raw body once
    const raw = await req.text();
    const event = JSON.parse(raw) as PayPalWebhookEvent;

    if (shouldVerify) {
      if (!webhookId) {
        throw new Error(
          "Missing PAYPAL_WEBHOOK_ID. This is the ID of the webhook subscription you created under your app's Webhooks section (Sandbox and Live have different IDs).",
        );
      }

      // PayPal headers used for verification
      const paypalAuthAlgo = requiredHeader(req, 'paypal-auth-algo');
      const paypalCertUrl = requiredHeader(req, 'paypal-cert-url');
      const paypalTransmissionId = requiredHeader(req, 'paypal-transmission-id');
      const paypalTransmissionSig = requiredHeader(req, 'paypal-transmission-sig');
      const paypalTransmissionTime = requiredHeader(req, 'paypal-transmission-time');

      // Verify authenticity (for real webhooks; simulator has limitations)
      const ok = await verifyWebhookSignature({
        event,
        webhookId,
        paypalAuthAlgo,
        paypalCertUrl,
        paypalTransmissionId,
        paypalTransmissionSig,
        paypalTransmissionTime,
      });

      if (!ok) {
        return new Response('Invalid signature', { status: 400 });
      }
    } else {
      // Dev/simulator mode: the PayPal Webhook Simulator sends mock events that are not verifiable.
      // Do NOT use this mode in production.
      console.warn(
        '[PayPal Webhook] Signature verification skipped (dev/simulator mode). Do NOT use this in production.',
      );
    }

    console.log(event);

    // Handle event types you care about
    // Common ones for capture-based checkouts:
    // PAYMENT.CAPTURE.COMPLETED / PENDING / DENIED  [oai_citation:12‡PayPal Developer](https://developer.paypal.com/beta/apm-beta/additional-information/subscribe-to-webhooks/)
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        // fulfill order
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        // mark as failed/cancel
        break;
      case 'PAYMENT.CAPTURE.PENDING':
        // wait, don’t fulfill yet
        break;
      default:
        // ignore or log
        break;
    }

    // Must return 2xx for success or PayPal will retry  [oai_citation:13‡PayPal Developer](https://developer.paypal.com/api/rest/webhooks/)
    return new Response('OK', { status: 200 });
  } catch (e: Error | unknown) {
    // Log safely
    const message = e instanceof Error ? e.message : String(e);
    console.error('PayPal webhook error:', message);
    return new Response('Webhook error', { status: 500 });
  }
}
