import 'server-only';

import {
  getEnvPayPalLedgerWebhookIds,
  getOrderedPayPalLedgerWebhookBindingKeys,
  getPayPalLedgerWebhookActivationSource,
  type PayPalLedgerWebhookActivationSource,
  type PayPalPaymentMode,
} from '@/lib/paypal/ledgerWebhookConfig';
import {
  isPaypalTxLedgerDatabaseConfigured,
  paypalTxLedger,
} from '@/lib/prisma/shop/paypal/paypalTxLedger';

export type PayPalLedgerWebhookTrustResolution = {
  activationSource: PayPalLedgerWebhookActivationSource;
  dbAvailable: boolean;
  envFallbackIds: string[];
  source: 'env' | 'db_hybrid' | 'env_fallback';
  webhookIds: string[];
};

export async function resolvePayPalLedgerTrustedWebhookIds(
  paymentMode: PayPalPaymentMode,
): Promise<PayPalLedgerWebhookTrustResolution> {
  const activationSource = getPayPalLedgerWebhookActivationSource();
  const envFallbackIds = getEnvPayPalLedgerWebhookIds(paymentMode);

  if (activationSource === 'env') {
    return {
      activationSource,
      dbAvailable: isPaypalTxLedgerDatabaseConfigured(),
      envFallbackIds,
      source: 'env',
      webhookIds: envFallbackIds,
    };
  }

  if (!isPaypalTxLedgerDatabaseConfigured()) {
    return {
      activationSource,
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
        key: true,
        webhookId: true,
      },
    });
    const activeByKey = new Map(activeBindings.map((binding) => [binding.key, binding.webhookId]));
    const orderedDbIds = getOrderedPayPalLedgerWebhookBindingKeys(paymentMode)
      .map((key) => activeByKey.get(key))
      .filter((webhookId): webhookId is string => Boolean(webhookId));
    const webhookIds = uniqueValues([...orderedDbIds, ...envFallbackIds]);

    return {
      activationSource,
      dbAvailable: true,
      envFallbackIds,
      source: orderedDbIds.length ? 'db_hybrid' : 'env_fallback',
      webhookIds,
    };
  } catch (error) {
    console.error('[paypal.ledger_webhook_trust.db_resolution_failed]', {
      paymentMode,
      error: error instanceof Error ? error.message : 'unknown_error',
    });

    return {
      activationSource,
      dbAvailable: false,
      envFallbackIds,
      source: 'env_fallback',
      webhookIds: envFallbackIds,
    };
  }
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
