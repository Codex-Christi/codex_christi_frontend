import 'server-only';

import {
  getOrderedPayPalLedgerWebhookBindingKeys,
  getPayPalLedgerWebhookActivationSource,
  getPayPalLedgerWebhookEnvValue,
  parsePayPalLedgerWebhookCsv,
  PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS,
  type PayPalLedgerWebhookActivationSource,
  type PayPalLedgerWebhookBindingKey,
  type PayPalPaymentMode,
} from '@/lib/paypal/ledgerWebhookConfig';
import {
  isPaypalTxLedgerDatabaseConfigured,
  paypalTxLedger,
} from '@/lib/prisma/shop/paypal/paypalTxLedger';

export type PayPalLedgerWebhookTrustResolution = {
  activationSource: PayPalLedgerWebhookActivationSource;
  candidates: PayPalLedgerTrustedWebhookCandidate[];
  dbAvailable: boolean;
  envFallbackIds: string[];
  source: 'env' | 'db_hybrid' | 'env_fallback';
  webhookIds: string[];
};

export type PayPalLedgerTrustedWebhookCandidate = {
  bindingKey: PayPalLedgerWebhookBindingKey | null;
  deploymentTarget: string | null;
  envVarName: string | null;
  label: string;
  source: 'db' | 'env';
  webhookId: string;
};

export async function resolvePayPalLedgerTrustedWebhookIds(
  paymentMode: PayPalPaymentMode,
): Promise<PayPalLedgerWebhookTrustResolution> {
  const activationSource = getPayPalLedgerWebhookActivationSource();
  const envCandidates = getEnvPayPalLedgerWebhookCandidates(paymentMode);
  const envFallbackIds = envCandidates.map((candidate) => candidate.webhookId);

  if (activationSource === 'env') {
    return {
      activationSource,
      candidates: envCandidates,
      dbAvailable: isPaypalTxLedgerDatabaseConfigured(),
      envFallbackIds,
      source: 'env',
      webhookIds: envFallbackIds,
    };
  }

  if (!isPaypalTxLedgerDatabaseConfigured()) {
    return {
      activationSource,
      candidates: envCandidates,
      dbAvailable: false,
      envFallbackIds,
      source: 'env_fallback',
      webhookIds: envFallbackIds,
    };
  }

  try {
    const activeBindings = await paypalTxLedger.paypalLedgerTransactionWebhookBinding.findMany({
      where: {
        paypalPaymentMode: paymentMode,
        isActive: true,
      },
      select: {
        deploymentTarget: true,
        envVarName: true,
        key: true,
        label: true,
        webhookId: true,
      },
    });
    const activeByKey = new Map(activeBindings.map((binding) => [binding.key, binding]));
    const dbCandidates = getOrderedPayPalLedgerWebhookBindingKeys(paymentMode)
      .map((key) => activeByKey.get(key))
      .filter((binding): binding is NonNullable<typeof binding> => Boolean(binding?.webhookId))
      .map(
        (binding): PayPalLedgerTrustedWebhookCandidate => ({
          bindingKey: binding.key as PayPalLedgerWebhookBindingKey,
          deploymentTarget: binding.deploymentTarget,
          envVarName: binding.envVarName,
          label: binding.label,
          source: 'db',
          webhookId: binding.webhookId,
        }),
      );
    const candidates = uniqueWebhookCandidates([...dbCandidates, ...envCandidates]);
    const webhookIds = candidates.map((candidate) => candidate.webhookId);

    return {
      activationSource,
      candidates,
      dbAvailable: true,
      envFallbackIds,
      source: dbCandidates.length ? 'db_hybrid' : 'env_fallback',
      webhookIds,
    };
  } catch (error) {
    console.error('[paypal.ledger_webhook_trust.db_resolution_failed]', {
      paymentMode,
      error: error instanceof Error ? error.message : 'unknown_error',
    });

    return {
      activationSource,
      candidates: envCandidates,
      dbAvailable: false,
      envFallbackIds,
      source: 'env_fallback',
      webhookIds: envFallbackIds,
    };
  }
}

function getEnvPayPalLedgerWebhookCandidates(paymentMode: PayPalPaymentMode) {
  const orderedDefinitions = getOrderedPayPalLedgerWebhookBindingKeys(paymentMode)
    .map((key) =>
      PAYPAL_LEDGER_WEBHOOK_BINDING_DEFINITIONS.find((definition) => definition.key === key),
    )
    .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition));
  const candidates = orderedDefinitions
    .map((definition): PayPalLedgerTrustedWebhookCandidate | null => {
      const webhookId = getPayPalLedgerWebhookEnvValue(definition.envVarName);
      if (!webhookId) return null;

      return {
        bindingKey: definition.key,
        deploymentTarget: definition.deploymentTarget,
        envVarName: definition.envVarName,
        label: definition.label,
        source: 'env',
        webhookId,
      };
    })
    .filter((candidate): candidate is PayPalLedgerTrustedWebhookCandidate => Boolean(candidate));
  const additionalIds =
    paymentMode === 'live'
      ? parsePayPalLedgerWebhookCsv(process.env.PAYPAL_LIVE_ADDITIONAL_WEBHOOK_IDS)
      : parsePayPalLedgerWebhookCsv(process.env.PAYPAL_SANDBOX_ADDITIONAL_WEBHOOK_IDS);

  return uniqueWebhookCandidates([
    ...candidates,
    ...additionalIds.map(
      (webhookId): PayPalLedgerTrustedWebhookCandidate => ({
        bindingKey: null,
        deploymentTarget: null,
        envVarName:
          paymentMode === 'live'
            ? 'PAYPAL_LIVE_ADDITIONAL_WEBHOOK_IDS'
            : 'PAYPAL_SANDBOX_ADDITIONAL_WEBHOOK_IDS',
        label: paymentMode === 'live' ? 'Live Additional Webhook' : 'Sandbox Additional Webhook',
        source: 'env',
        webhookId,
      }),
    ),
  ]);
}

function uniqueWebhookCandidates(candidates: PayPalLedgerTrustedWebhookCandidate[]) {
  const seen = new Set<string>();
  const unique: PayPalLedgerTrustedWebhookCandidate[] = [];

  for (const candidate of candidates) {
    if (!candidate.webhookId || seen.has(candidate.webhookId)) continue;

    seen.add(candidate.webhookId);
    unique.push(candidate);
  }

  return unique;
}
