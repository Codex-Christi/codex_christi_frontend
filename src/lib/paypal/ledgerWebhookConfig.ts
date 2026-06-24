import 'server-only';

import { getMainSiteUrl } from '@/lib/siteBaseUrls';

export type PayPalPaymentMode = 'sandbox' | 'live';
export type PayPalLedgerWebhookActivationSource = 'env' | 'db_hybrid';
export type PayPalLedgerWebhookBindingKey =
  | 'sandbox_ngrok'
  | 'sandbox_production'
  | 'live_production';
export type PayPalLedgerWebhookDeploymentTarget = 'ngrok_tunnel' | 'production_domain';
export type PayPalWebhookProcessingOwner = PayPalLedgerWebhookBindingKey | 'none';
export type PayPalWebhookProcessingOwnerSource = 'default' | 'env' | 'invalid_env';

export const PAYPAL_LEDGER_WEBHOOK_PATH = '/next-api/paypal/webhooks/ledger-transaction-events';

export const PAYPAL_LEDGER_WEBHOOK_REQUIRED_EVENTS = [
  'PAYMENT.AUTHORIZATION.CREATED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.DECLINED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED',
] as const;

export const PAYPAL_LEDGER_WEBHOOK_ACTIVATION_SOURCE_ENV =
  'PAYPAL_LEDGER_WEBHOOK_ACTIVATION_SOURCE';
export const PAYPAL_SANDBOX_WEBHOOK_PROCESSING_OWNER_ENV =
  'PAYPAL_SANDBOX_WEBHOOK_PROCESSING_OWNER';
export const PAYPAL_LIVE_WEBHOOK_PROCESSING_OWNER_ENV = 'PAYPAL_LIVE_WEBHOOK_PROCESSING_OWNER';

export const PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS = [
  {
    key: 'sandbox_ngrok',
    label: 'Sandbox Ngrok',
    paypalPaymentMode: 'sandbox',
    deploymentTarget: 'ngrok_tunnel',
    envVarName: 'PAYPAL_SANDBOX_NGROK_WEBHOOK_ID',
  },
  {
    key: 'sandbox_production',
    label: 'Sandbox Production Listener',
    paypalPaymentMode: 'sandbox',
    deploymentTarget: 'production_domain',
    envVarName: 'PAYPAL_SANDBOX_PRODUCTION_WEBHOOK_ID',
  },
  {
    key: 'live_production',
    label: 'Live Production Listener',
    paypalPaymentMode: 'live',
    deploymentTarget: 'production_domain',
    envVarName: 'PAYPAL_LIVE_PRODUCTION_WEBHOOK_ID',
  },
] as const;

export type PayPalLedgerWebhookBindingDefinition =
  (typeof PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS)[number];

export type PayPalWebhookProcessingOwnership = {
  allowedOwners: PayPalWebhookProcessingOwner[];
  envVarName:
    | typeof PAYPAL_SANDBOX_WEBHOOK_PROCESSING_OWNER_ENV
    | typeof PAYPAL_LIVE_WEBHOOK_PROCESSING_OWNER_ENV;
  error: string | null;
  owner: PayPalWebhookProcessingOwner;
  source: PayPalWebhookProcessingOwnerSource;
};

export function getPayPalLedgerWebhookActivationSource(): PayPalLedgerWebhookActivationSource {
  const configured = (
    process.env[PAYPAL_LEDGER_WEBHOOK_ACTIVATION_SOURCE_ENV] ?? 'env'
  ).toLowerCase();

  if (configured === 'env' || configured === 'db_hybrid') {
    return configured;
  }

  throw new Error(
    `Invalid ${PAYPAL_LEDGER_WEBHOOK_ACTIVATION_SOURCE_ENV}. Expected "env" or "db_hybrid".`,
  );
}

export function getConfiguredPayPalPaymentMode(): PayPalPaymentMode {
  const configured = process.env.PAYPAL_PAYMENT_MODE?.trim().toLowerCase();

  if (configured === 'sandbox' || configured === 'live') {
    return configured;
  }

  throw new Error('Missing PAYPAL_PAYMENT_MODE. Expected "sandbox" or "live".');
}

export function getDefaultPayPalWebhookProcessingOwner(
  paymentMode: PayPalPaymentMode,
): PayPalWebhookProcessingOwner {
  if (paymentMode === 'live') {
    return process.env.NODE_ENV === 'production' ? 'live_production' : 'none';
  }

  return process.env.NODE_ENV === 'production' ? 'sandbox_production' : 'sandbox_ngrok';
}

export function getAllowedPayPalWebhookProcessingOwners(
  paymentMode: PayPalPaymentMode,
): PayPalWebhookProcessingOwner[] {
  return paymentMode === 'live'
    ? ['live_production', 'none']
    : ['sandbox_ngrok', 'sandbox_production', 'none'];
}

export function getPayPalWebhookProcessingOwner(
  paymentMode: PayPalPaymentMode,
): PayPalWebhookProcessingOwnership {
  const envVarName =
    paymentMode === 'live'
      ? PAYPAL_LIVE_WEBHOOK_PROCESSING_OWNER_ENV
      : PAYPAL_SANDBOX_WEBHOOK_PROCESSING_OWNER_ENV;
  const allowedOwners = getAllowedPayPalWebhookProcessingOwners(paymentMode);
  const configured = process.env[envVarName]?.trim().toLowerCase();

  if (!configured) {
    return {
      allowedOwners,
      envVarName,
      error: null,
      owner: getDefaultPayPalWebhookProcessingOwner(paymentMode),
      source: 'default',
    };
  }

  if (allowedOwners.includes(configured as PayPalWebhookProcessingOwner)) {
    return {
      allowedOwners,
      envVarName,
      error: null,
      owner: configured as PayPalWebhookProcessingOwner,
      source: 'env',
    };
  }

  return {
    allowedOwners,
    envVarName,
    error: `Invalid ${envVarName}. Expected one of: ${allowedOwners.join(', ')}.`,
    owner: 'none',
    source: 'invalid_env',
  };
}

export function getOptionalConfiguredPayPalPaymentMode() {
  try {
    return {
      paymentMode: getConfiguredPayPalPaymentMode(),
      error: null,
    };
  } catch (error) {
    return {
      paymentMode: null,
      error: error instanceof Error ? error.message : 'Invalid PAYPAL_PAYMENT_MODE.',
    };
  }
}

export function getPayPalLedgerWebhookProductionUrl() {
  return getMainSiteUrl(PAYPAL_LEDGER_WEBHOOK_PATH);
}

export function getPayPalLedgerWebhookDefinition(key: string) {
  return PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS.find((definition) => definition.key === key);
}

export function getPayPalLedgerWebhookExpectedUrl(
  definition: PayPalLedgerWebhookBindingDefinition,
) {
  return definition.deploymentTarget === 'production_domain'
    ? getPayPalLedgerWebhookProductionUrl()
    : null;
}

export function getPayPalLedgerWebhookEnvValue(envVarName: string) {
  return process.env[envVarName]?.trim() || null;
}

export function parsePayPalLedgerWebhookCsv(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getEnvPayPalLedgerWebhookIds(paymentMode: PayPalPaymentMode) {
  if (paymentMode === 'live') {
    return uniqueValues([
      getPayPalLedgerWebhookEnvValue('PAYPAL_LIVE_PRODUCTION_WEBHOOK_ID'),
      ...parsePayPalLedgerWebhookCsv(process.env.PAYPAL_LIVE_ADDITIONAL_WEBHOOK_IDS),
    ]);
  }

  const sandboxProductionId = getPayPalLedgerWebhookEnvValue(
    'PAYPAL_SANDBOX_PRODUCTION_WEBHOOK_ID',
  );
  const sandboxNgrokId = getPayPalLedgerWebhookEnvValue('PAYPAL_SANDBOX_NGROK_WEBHOOK_ID');
  const additionalSandboxIds = parsePayPalLedgerWebhookCsv(
    process.env.PAYPAL_SANDBOX_ADDITIONAL_WEBHOOK_IDS,
  );

  if (process.env.NODE_ENV === 'production') {
    return uniqueValues([sandboxProductionId, sandboxNgrokId, ...additionalSandboxIds]);
  }

  return uniqueValues([sandboxNgrokId, sandboxProductionId, ...additionalSandboxIds]);
}

export function getOrderedPayPalLedgerWebhookBindingKeys(
  paymentMode: PayPalPaymentMode,
): PayPalLedgerWebhookBindingKey[] {
  if (paymentMode === 'live') {
    return ['live_production'];
  }

  return process.env.NODE_ENV === 'production'
    ? ['sandbox_production', 'sandbox_ngrok']
    : ['sandbox_ngrok', 'sandbox_production'];
}

function uniqueValues(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;

    seen.add(value);
    unique.push(value);
  }

  return unique;
}
