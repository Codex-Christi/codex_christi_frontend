import 'server-only';

import {
  PAYPAL_LEDGER_WEBHOOK_PATH,
  PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS,
  type PayPalPaymentMode,
} from '@/lib/paypal/ledgerWebhookConfig';

type PayPalWebhookRegistryConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
};

type RegisterPayPalWebhookArgs = {
  paymentMode: PayPalPaymentMode;
  webhookId?: string | null;
  webhookUrl: string;
};

export type RegisterPayPalWebhookResult = {
  action: 'created' | 'patched';
  webhookId: string;
  webhookUrl: string;
};

export async function registerPayPalLedgerWebhook({
  paymentMode,
  webhookId,
  webhookUrl,
}: RegisterPayPalWebhookArgs): Promise<RegisterPayPalWebhookResult> {
  const normalizedWebhookUrl = normalizeWebhookUrl(webhookUrl);
  const config = getPayPalWebhookRegistryConfig(paymentMode);
  const accessToken = await getPayPalAccessToken(config);
  const normalizedWebhookId = webhookId?.trim();

  if (normalizedWebhookId) {
    await patchPayPalWebhook({
      accessToken,
      baseUrl: config.baseUrl,
      webhookId: normalizedWebhookId,
      webhookUrl: normalizedWebhookUrl,
    });

    return {
      action: 'patched',
      webhookId: normalizedWebhookId,
      webhookUrl: normalizedWebhookUrl,
    };
  }

  const createdWebhookId = await createPayPalWebhook({
    accessToken,
    baseUrl: config.baseUrl,
    webhookUrl: normalizedWebhookUrl,
  });

  return {
    action: 'created',
    webhookId: createdWebhookId,
    webhookUrl: normalizedWebhookUrl,
  };
}

function getPayPalWebhookRegistryConfig(
  paymentMode: PayPalPaymentMode,
): PayPalWebhookRegistryConfig {
  const isLive = paymentMode === 'live';
  const clientId = isLive
    ? process.env.PAYPAL_LIVE_CLIENT_ID
    : process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const clientSecret = isLive
    ? process.env.PAYPAL_LIVE_CLIENT_SECRET
    : process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

  return {
    baseUrl: isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    clientId: required(clientId, `Missing PayPal ${paymentMode} client ID.`),
    clientSecret: required(clientSecret, `Missing PayPal ${paymentMode} client secret.`),
  };
}

async function getPayPalAccessToken({
  baseUrl,
  clientId,
  clientSecret,
}: PayPalWebhookRegistryConfig) {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
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

  const data = (await response.json()) as { access_token?: string };
  const accessToken = data.access_token?.trim();

  if (!accessToken) {
    throw new Error('PayPal token response did not include an access token.');
  }

  return accessToken;
}

async function createPayPalWebhook({
  accessToken,
  baseUrl,
  webhookUrl,
}: {
  accessToken: string;
  baseUrl: string;
  webhookUrl: string;
}) {
  const response = await fetch(`${baseUrl}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: webhookUrl,
      event_types: PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS.map((name) => ({ name })),
    }),
  });

  if (!response.ok) {
    throw new Error(`PayPal webhook create error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { id?: string };
  const webhookId = data.id?.trim();

  if (!webhookId) {
    throw new Error('PayPal webhook create response did not include a webhook ID.');
  }

  return webhookId;
}

async function patchPayPalWebhook({
  accessToken,
  baseUrl,
  webhookId,
  webhookUrl,
}: {
  accessToken: string;
  baseUrl: string;
  webhookId: string;
  webhookUrl: string;
}) {
  const response = await fetch(
    `${baseUrl}/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          op: 'replace',
          path: '/url',
          value: webhookUrl,
        },
        {
          op: 'replace',
          path: '/event_types',
          value: PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS.map((name) => ({ name })),
        },
      ]),
    },
  );

  if (!response.ok) {
    throw new Error(`PayPal webhook patch error: ${response.status} ${await response.text()}`);
  }
}

function normalizeWebhookUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error('Webhook URL is required.');
  }

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    const host = trimmed.includes('.') ? trimmed : `${trimmed}.ngrok-free.app`;

    return `https://${host}${PAYPAL_LEDGER_WEBHOOK_PATH}`;
  }

  try {
    const parsed = new URL(trimmed.replace(/\/+$/, ''));

    if (parsed.protocol !== 'https:') {
      throw new Error('Webhook URL must use https.');
    }

    if (parsed.pathname === PAYPAL_LEDGER_WEBHOOK_PATH) {
      return parsed.toString().replace(/\/+$/, '');
    }

    if (parsed.pathname === '/next-api') {
      return `${parsed.origin}/next-api/paypal/webhooks/ledger-transaction-events`;
    }

    return `${parsed.toString().replace(/\/+$/, '')}${PAYPAL_LEDGER_WEBHOOK_PATH}`;
  } catch (error) {
    if (error instanceof Error && error.message === 'Webhook URL must use https.') {
      throw error;
    }

    throw new Error('Enter a valid webhook URL.');
  }
}

function required(value: string | undefined, message: string) {
  const normalized = value?.trim();

  if (!normalized) throw new Error(message);

  return normalized;
}
