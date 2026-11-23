import type { PublicRuntimeConfig } from '@/lib/runtime-config/client';

// Do not create SDK options until the server's public payment config is available.
export function getPublicPayPalOptions(
  config: PublicRuntimeConfig | null,
  currency: string | undefined,
  buyerCountry: string | null | undefined,
) {
  if (!config || !currency) return null;
  return {
    clientId: config.paymentClientId,
    'enable-funding': 'venmo',
    'buyer-country': buyerCountry ?? 'US',
    intent: 'authorize',
    components: 'buttons,card-fields',
    'data-sdk-integration-source': 'developer-studio',
    currency,
  } as const;
}
