export type MerchizeReadinessCategory =
  | 'address'
  | 'items'
  | 'artwork'
  | 'cost'
  | 'attention'
  | 'order'
  | 'provider'
  | 'age';

export type MerchizeReadinessBlocker = {
  code: string;
  message: string;
  category: MerchizeReadinessCategory;
  retryable: boolean;
};

export type MerchizeProviderPushState = 'not_pushed' | 'pending' | 'pushed' | 'failed';

export type MerchizeProductionReadiness = {
  ready: boolean;
  status: 'ready' | 'pending' | 'blocked' | 'manual_release_required' | 'already_pushed';
  blockers: MerchizeReadinessBlocker[];
  primaryBlocker: MerchizeReadinessBlocker | null;
  addressReviewStatus: string;
  itemReviewStatus: string;
  artworkReviewStatus: string;
  costReviewStatus: string;
  attentionReviewStatus: string;
  providerPushProgress: string | null;
  providerPushState: MerchizeProviderPushState;
  providerPaidAt: Date | null;
  manualReleaseRequired: boolean;
};

type ReadinessPayloads = {
  detail: unknown;
  addressSuggestion: unknown;
  unfulfilledItems: unknown;
  fulfillmentCost: unknown;
  requireAttention: unknown;
  sendToFulfillment: unknown;
  now?: Date;
  allowStaleOrderManualRelease?: boolean;
};

const INVALID_ADDRESS_STATUSES = new Set([
  'invalid',
  'street_undefined',
  'zipcode_undefined',
  'inactive',
  'missing_secondary',
  'vacant',
  'spelling',
  'fullname_undefined',
]);
const BUYER_CONFIRMABLE_ADDRESS_STATUSES = new Set([
  'street_undefined',
  'zipcode_undefined',
  'inactive',
  'missing_secondary',
  'vacant',
  'spelling',
  'fullname_undefined',
  'pending',
]);
const FAILED_ITEM_STATUSES = new Set(['failed', 'unmapped', 'error', 'invalid', 'rejected']);
const STALE_ORDER_DAYS = 7;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function getDataRecord(payload: unknown) {
  return asRecord(asRecord(payload)?.data) ?? asRecord(payload);
}

function getResponseMessage(payload: unknown) {
  return asString(asRecord(payload)?.message)?.toLowerCase() ?? '';
}

function getEnvelopeData(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return payload;
  if ('data' in record || 'success' in record || 'message' in record) return record.data;
  return payload;
}

function hasProviderEvidence(value: unknown) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  const record = asRecord(value);
  return record ? Object.keys(record).length > 0 : true;
}

function isTransientProviderMessage(message: string) {
  return [
    'being processed',
    'processing',
    'pending',
    'not ready',
    'please wait',
    'calculating',
    'generating',
  ].some((phrase) => message.includes(phrase));
}

function getDataArray(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  const data = asRecord(payload)?.data;
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  for (const key of ['items', 'orders', 'results', 'requires', 'attentions']) {
    if (Array.isArray(record?.[key])) return record[key] as unknown[];
  }
  return [];
}

function parseDate(value: unknown) {
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addBlocker(
  blockers: MerchizeReadinessBlocker[],
  blocker: MerchizeReadinessBlocker,
) {
  if (!blockers.some((candidate) => candidate.code === blocker.code)) {
    blockers.push(blocker);
  }
}

function collectNestedRecords(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5 || value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNestedRecords(item, depth + 1));
  }

  const record = asRecord(value);
  if (!record) return [];

  return [
    record,
    ...Object.values(record).flatMap((item) => collectNestedRecords(item, depth + 1)),
  ];
}

function classifyProviderPushState(detail: unknown, sendToFulfillment: unknown) {
  const detailData = getDataRecord(detail);
  const sendData = getDataRecord(sendToFulfillment);
  const progress = asString(detailData?.push_to_fulfillment_progress)?.toLowerCase() ?? null;
  const sent = asBoolean(sendData?.pushed);
  const sendFailed = asBoolean(sendData?.is_failed);

  if (progress === 'pushed' || sent === true) {
    return { progress: progress ?? 'pushed', state: 'pushed' as const };
  }
  if (progress === 'failed' || sendFailed === true) {
    return { progress: progress ?? 'failed', state: 'failed' as const };
  }
  if (progress && ['validating', 'scheduled', 'paused'].includes(progress)) {
    return { progress, state: 'pending' as const };
  }

  return { progress, state: 'not_pushed' as const };
}

export function classifyMerchizeProductionReadiness({
  detail,
  addressSuggestion,
  unfulfilledItems,
  fulfillmentCost,
  requireAttention,
  sendToFulfillment,
  now = new Date(),
  allowStaleOrderManualRelease = false,
}: ReadinessPayloads): MerchizeProductionReadiness {
  const blockers: MerchizeReadinessBlocker[] = [];
  const detailData = getDataRecord(detail);
  const validationStatus =
    asString(detailData?.validate_shipping_address)?.toLowerCase() ?? 'unknown';
  const markValidAddress = asBoolean(detailData?.mark_valid_address) === true;
  const push = classifyProviderPushState(detail, sendToFulfillment);

  let addressReviewStatus = 'unknown';
  if (validationStatus === 'valid' || validationStatus === 'ignored') {
    addressReviewStatus = 'ready';
  } else if (markValidAddress && BUYER_CONFIRMABLE_ADDRESS_STATUSES.has(validationStatus)) {
    addressReviewStatus = 'buyer_confirmed';
  } else if (validationStatus === 'pending') {
    addressReviewStatus = 'pending';
    addBlocker(blockers, {
      code: 'MERCHIZE_ADDRESS_VALIDATION_PENDING',
      message: 'Merchize is still validating the shipping address.',
      category: 'address',
      retryable: true,
    });
  } else if (INVALID_ADDRESS_STATUSES.has(validationStatus)) {
    addressReviewStatus = 'blocked';
    addBlocker(blockers, {
      code: 'MERCHIZE_ADDRESS_INVALID',
      message: `Merchize reports an invalid shipping address (${validationStatus}).`,
      category: 'address',
      retryable: false,
    });
  } else {
    const suggestionCount = getDataArray(addressSuggestion).length;
    addBlocker(blockers, {
      code: 'MERCHIZE_ADDRESS_VALIDATION_UNKNOWN',
      message:
        suggestionCount > 0
          ? 'Merchize returned an address suggestion but no explicit valid address state.'
          : 'Merchize did not return an explicit valid shipping-address state.',
      category: 'address',
      retryable: true,
    });
  }

  let itemReviewStatus = 'ready';
  const unfulfilledRoot = asRecord(unfulfilledItems);
  if (unfulfilledRoot?.success === false) {
    itemReviewStatus = 'blocked';
    addBlocker(blockers, {
      code: 'MERCHIZE_ITEMS_UNAVAILABLE',
      message: 'Merchize could not load the unfulfilled order items.',
      category: 'items',
      retryable: false,
    });
  }

  const itemRecords = collectNestedRecords(unfulfilledItems);
  const hasUnavailableProduct = itemRecords.some(
    (record) => record.is_deleted === true || record.is_active === false,
  );
  const hasUnmappedProduct = itemRecords.some((record) => {
    const mappingStatus = asString(record.mapping_status)?.toLowerCase();
    const itemStatus = asString(record.ffm_map_item_status)?.toLowerCase();
    return (
      (Boolean(mappingStatus) && FAILED_ITEM_STATUSES.has(mappingStatus as string)) ||
      (Boolean(itemStatus) && FAILED_ITEM_STATUSES.has(itemStatus as string))
    );
  });

  if (hasUnavailableProduct) {
    itemReviewStatus = 'blocked';
    addBlocker(blockers, {
      code: 'MERCHIZE_PRODUCT_UNAVAILABLE',
      message: 'At least one mapped Merchize product or variant is inactive or deleted.',
      category: 'items',
      retryable: false,
    });
  }
  if (hasUnmappedProduct) {
    itemReviewStatus = 'blocked';
    addBlocker(blockers, {
      code: 'MERCHIZE_CATALOG_MAPPING_REQUIRED',
      message: 'At least one order item is not mapped to an active Merchize catalog variant.',
      category: 'items',
      retryable: false,
    });
  }

  const artworkStatus = asString(detailData?.artwork_status)?.toLowerCase();
  let artworkReviewStatus = 'ready';
  if (artworkStatus === 'missing' || artworkStatus === 'incomplete') {
    artworkReviewStatus = 'blocked';
    addBlocker(blockers, {
      code: 'MERCHIZE_ARTWORK_MISSING',
      message: 'Merchize reports missing or incomplete production artwork.',
      category: 'artwork',
      retryable: false,
    });
  } else if (artworkStatus === 'pending') {
    artworkReviewStatus = 'pending';
    addBlocker(blockers, {
      code: 'MERCHIZE_ARTWORK_PENDING',
      message: 'Merchize is still processing the production artwork.',
      category: 'artwork',
      retryable: true,
    });
  } else if (!artworkStatus) {
    artworkReviewStatus = 'unknown';
  }

  const costRoot = asRecord(fulfillmentCost);
  const costData = getEnvelopeData(fulfillmentCost);
  const costMessage = getResponseMessage(fulfillmentCost);
  let costReviewStatus = 'ready';
  if (costRoot?.success === false) {
    const retryable = isTransientProviderMessage(costMessage);
    costReviewStatus = retryable ? 'pending' : 'blocked';
    addBlocker(blockers, {
      code: retryable
        ? 'MERCHIZE_FULFILLMENT_COST_PENDING'
        : 'MERCHIZE_FULFILLMENT_COST_UNAVAILABLE',
      message: retryable
        ? 'Merchize is still calculating the fulfillment-cost invoice.'
        : 'Merchize could not calculate a fulfillment-cost invoice for this order.',
      category: 'cost',
      retryable,
    });
  } else if (!hasProviderEvidence(costData)) {
    costReviewStatus = 'pending';
    addBlocker(blockers, {
      code: 'MERCHIZE_FULFILLMENT_COST_PENDING',
      message: 'Merchize has not returned fulfillment-cost evidence yet.',
      category: 'cost',
      retryable: true,
    });
  }

  const attentions = getDataArray(requireAttention);
  const attentionReviewStatus = attentions.length > 0 ? 'blocked' : 'ready';
  if (attentions.length > 0) {
    addBlocker(blockers, {
      code: 'MERCHIZE_PROVIDER_ATTENTION_REQUIRED',
      message: 'Merchize has one or more unresolved attention requests for this order.',
      category: 'attention',
      retryable: false,
    });
  }

  const orderStatus = asString(detailData?.order_status)?.toLowerCase();
  if (
    detailData?.is_deleted === true ||
    orderStatus === 'cancelled' ||
    orderStatus === 'canceled' ||
    orderStatus === 'closed'
  ) {
    addBlocker(blockers, {
      code: 'MERCHIZE_ORDER_NOT_RELEASEABLE',
      message: 'The Merchize order is deleted, cancelled, or closed.',
      category: 'order',
      retryable: false,
    });
  }

  const providerPaidAt = parseDate(detailData?.paid_at) ?? parseDate(detailData?.created);
  const ageMs = providerPaidAt ? now.getTime() - providerPaidAt.getTime() : 0;
  const manualReleaseRequired =
    push.state !== 'pushed' && ageMs > STALE_ORDER_DAYS * 24 * 60 * 60_000;
  if (manualReleaseRequired && !allowStaleOrderManualRelease) {
    addBlocker(blockers, {
      code: 'MERCHIZE_MANUAL_RELEASE_REQUIRED',
      message: 'This order is older than seven days and requires a master-admin manual release.',
      category: 'age',
      retryable: false,
    });
  }

  const primaryBlocker = blockers[0] ?? null;
  const onlyManualReleaseBlocker =
    blockers.length === 1 && primaryBlocker?.code === 'MERCHIZE_MANUAL_RELEASE_REQUIRED';
  const hasRetryableOnly = blockers.length > 0 && blockers.every((blocker) => blocker.retryable);
  const status =
    push.state === 'pushed'
      ? 'already_pushed'
      : blockers.length === 0
        ? 'ready'
        : onlyManualReleaseBlocker
          ? 'manual_release_required'
          : hasRetryableOnly
            ? 'pending'
            : 'blocked';

  return {
    ready: status === 'ready' || status === 'already_pushed',
    status,
    blockers,
    primaryBlocker,
    addressReviewStatus,
    itemReviewStatus,
    artworkReviewStatus,
    costReviewStatus,
    attentionReviewStatus,
    providerPushProgress: push.progress,
    providerPushState: push.state,
    providerPaidAt,
    manualReleaseRequired,
  };
}
