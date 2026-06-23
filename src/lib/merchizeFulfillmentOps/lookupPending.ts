export const MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_ERROR_CODE =
  'MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING';

export const MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_MESSAGE =
  'Merchize accepted the external order but is still indexing it. Retry provider sync shortly.';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function isMerchizeLookupPendingProviderProcessingError(errorCode?: string | null) {
  return errorCode === MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_ERROR_CODE;
}

export function isMerchizeProviderProcessingLookupPayload(payload: unknown) {
  const record = asRecord(payload);
  const message = asString(record?.message)?.toLowerCase();

  if (!message) return false;

  return (
    message.includes('order is being processed') ||
    (message.includes('order') && message.includes('being processed'))
  );
}
