import 'server-only';

export function isMerchizeFulfillmentPushEnabled() {
  const value = process.env.MERCHIZE_FULFILLMENT_PUSH_ENABLED;

  if (value === undefined || value.trim() === '') return true;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  throw new Error('Invalid MERCHIZE_FULFILLMENT_PUSH_ENABLED. Expected "true" or "false".');
}
