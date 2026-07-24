export type MerchizeReadinessCategory =
  'address' | 'items' | 'artwork' | 'cost' | 'attention' | 'order' | 'provider' | 'age';

export type MerchizeReadinessBlocker = {
  code: string;
  message: string;
  category: MerchizeReadinessCategory;
  retryable: boolean;
};

export type MerchizeProviderPushState = 'not_pushed' | 'pending' | 'pushed' | 'failed';

export type MerchizeAddressValidationEvidence = {
  status: string;
  markedValid: boolean;
};

export type MerchizeProductionReadiness = {
  ready: boolean;
  status: 'ready' | 'pending' | 'blocked' | 'manual_release_required' | 'already_pushed';
  blockers: MerchizeReadinessBlocker[];
  primaryBlocker: MerchizeReadinessBlocker | null;
  addressValidationStatus: string;
  addressMarkedValid: boolean;
  addressReadbackStatus: 'matched' | 'mismatch' | 'not_checked';
  addressReadbackMismatchFields: string[];
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
  fulfillmentInvoice: unknown;
  requireAttention: unknown;
  sendToFulfillment: unknown;
  buyerAddressMismatchFields?: string[] | null;
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
  'invalid',
  'street_undefined',
  'zipcode_undefined',
  'inactive',
  'missing_secondary',
  'vacant',
  'spelling',
  'fullname_undefined',
  'pending',
]);
const NON_US_ADDRESS_STATUSES = new Set(['other', 'others']);
const BUYER_ADDRESS_FIELD_NAMES = new Set([
  'line1',
  'line2',
  'city',
  'state',
  'postalCode',
  'countryCode',
]);
const FAILED_ITEM_STATUSES = new Set([
  'failed',
  'unmapped',
  'not_mapped',
  'error',
  'invalid',
  'rejected',
]);
const STALE_ORDER_DAYS = 7;
type ExternalInvoiceState = 'available' | 'paid' | 'placeholder' | 'provider_error';

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

export function getMerchizeAddressValidationEvidence(
  detail: unknown,
): MerchizeAddressValidationEvidence {
  const detailData = getDataRecord(detail);

  return {
    status: asString(detailData?.validate_shipping_address)?.toLowerCase() ?? 'unknown',
    markedValid: asBoolean(detailData?.mark_valid_address) === true,
  };
}

export function canManuallyConfirmMerchizeAddressStatus(status: string) {
  return BUYER_CONFIRMABLE_ADDRESS_STATUSES.has(status.toLowerCase());
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

function addBlocker(blockers: MerchizeReadinessBlocker[], blocker: MerchizeReadinessBlocker) {
  if (!blockers.some((candidate) => candidate.code === blocker.code)) {
    blockers.push(blocker);
  }
}

function getUnfulfilledItemRecords(payload: unknown) {
  return getDataArray(payload)
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record));
}

function hasFailedMappingStatus(record: Record<string, unknown>) {
  return [record.mapping_status, record.ffm_map_item_status].some((value) => {
    const status = asString(value)?.toLowerCase().replace(/\s+/g, '_');
    return Boolean(status && FAILED_ITEM_STATUSES.has(status));
  });
}

function hasResolvedCatalogVariant(item: Record<string, unknown>) {
  const variant = asRecord(item.variant);
  if (!variant || variant.is_deleted === true || variant.is_active === false) return false;

  return Boolean(
    item.catalogInfo ??
    item.catalog_info ??
    asString(item.ffm_mapped_catalog_sku) ??
    asString(variant.sku),
  );
}

function isDirectItemUnavailable(item: Record<string, unknown>) {
  if (item.is_deleted === true || item.is_active === false) return true;

  const variant = asRecord(item.variant);
  if (variant) {
    return variant.is_deleted === true || variant.is_active === false;
  }

  const product = asRecord(item.product);
  return product?.is_deleted === true || product?.is_active === false;
}

function isDirectItemUnmapped(item: Record<string, unknown>) {
  if (hasFailedMappingStatus(item)) return true;

  const variant = asRecord(item.variant);
  if (variant && hasFailedMappingStatus(variant)) return true;

  const product = asRecord(item.product);
  return Boolean(product && !hasResolvedCatalogVariant(item) && hasFailedMappingStatus(product));
}

function classifyExternalInvoice(payload: unknown): ExternalInvoiceState {
  const root = asRecord(payload);
  if (root?.success !== true || !Array.isArray(root.data)) return 'provider_error';

  const row = asRecord(getDataArray(payload)[0]);
  const fulfillmentCost = row?.fulfillment_cost;
  if (typeof fulfillmentCost === 'number') {
    return fulfillmentCost > 0 ? 'available' : 'placeholder';
  }

  const costRecord = asRecord(fulfillmentCost);
  if (!costRecord || Object.keys(costRecord).length === 0) return 'placeholder';

  return asString(costRecord.status)?.toLowerCase() === 'paid' ? 'paid' : 'available';
}

function classifyProviderPushState(detail: unknown, sendToFulfillment: unknown) {
  const detailData = getDataRecord(detail);
  const sendData = getDataRecord(sendToFulfillment);
  const progress = asString(detailData?.push_to_fulfillment_progress)?.toLowerCase() ?? null;
  const sent =
    asBoolean(sendData?.pushed) === true || asBoolean(sendData?.is_pushed) === true;
  const sendFailed = asBoolean(sendData?.is_failed);

  if (progress === 'pushed' || sent) {
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
  fulfillmentInvoice,
  requireAttention,
  sendToFulfillment,
  buyerAddressMismatchFields,
  now = new Date(),
  allowStaleOrderManualRelease = false,
}: ReadinessPayloads): MerchizeProductionReadiness {
  const blockers: MerchizeReadinessBlocker[] = [];
  const detailData = getDataRecord(detail);
  const addressEvidence = getMerchizeAddressValidationEvidence(detail);
  const validationStatus = addressEvidence.status;
  const markValidAddress = addressEvidence.markedValid;
  const push = classifyProviderPushState(detail, sendToFulfillment);

  let addressReviewStatus = 'unknown';
  if (
    validationStatus === 'valid' ||
    validationStatus === 'ignore' ||
    validationStatus === 'ignored' ||
    NON_US_ADDRESS_STATUSES.has(validationStatus)
  ) {
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

  const addressReadbackMismatchFields =
    buyerAddressMismatchFields === undefined || buyerAddressMismatchFields === null
      ? []
      : [
          ...new Set(
            buyerAddressMismatchFields.filter((field) => BUYER_ADDRESS_FIELD_NAMES.has(field)),
          ),
        ];
  const addressReadbackStatus =
    buyerAddressMismatchFields === undefined || buyerAddressMismatchFields === null
      ? 'not_checked'
      : addressReadbackMismatchFields.length > 0
        ? 'mismatch'
        : 'matched';

  if (addressReadbackStatus === 'mismatch') {
    addressReviewStatus = 'blocked';
    addBlocker(blockers, {
      code: 'MERCHIZE_PROVIDER_ADDRESS_MISMATCH',
      message: `Merchize buyer details do not match the effective fulfillment address (${addressReadbackMismatchFields.join(', ')}).`,
      category: 'address',
      retryable: false,
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

  const itemRecords = getUnfulfilledItemRecords(unfulfilledItems);
  const hasUnavailableProduct = itemRecords.some(isDirectItemUnavailable);
  const hasUnmappedProduct = itemRecords.some(isDirectItemUnmapped);

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

  const allProductsExplicitlySkipArtwork =
    itemRecords.length > 0 &&
    itemRecords.every((item) => {
      const product = asRecord(item.product);
      return product?.no_need_artworks === true || item.no_need_artworks === true;
    });
  const allItemsUseStoredCatalogVariants =
    itemRecords.length > 0 && itemRecords.every(hasResolvedCatalogVariant);
  const artworkStatus = asString(detailData?.artwork_status)?.toLowerCase();
  let artworkReviewStatus = 'ready';
  if (
    (artworkStatus === 'missing' || artworkStatus === 'incomplete') &&
    allProductsExplicitlySkipArtwork
  ) {
    artworkReviewStatus = 'not_required';
  } else if (
    (artworkStatus === 'missing' || artworkStatus === 'incomplete') &&
    allItemsUseStoredCatalogVariants
  ) {
    artworkReviewStatus = 'catalog_managed';
  } else if (artworkStatus === 'missing' || artworkStatus === 'incomplete') {
    artworkReviewStatus = 'blocked';
    addBlocker(blockers, {
      code: 'MERCHIZE_ARTWORK_MISSING',
      message:
        'Merchize reports required production artwork is missing or incomplete for an item without a resolved stored catalog variant.',
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

  const invoiceState = classifyExternalInvoice(fulfillmentInvoice);
  const costReviewStatus =
    invoiceState === 'placeholder'
      ? push.state === 'pushed'
        ? 'pending'
        : 'awaiting_fulfillment'
      : invoiceState;
  if (invoiceState === 'provider_error') {
    addBlocker(blockers, {
      code: 'MERCHIZE_INVOICE_LOOKUP_FAILED',
      message:
        'Merchize rejected the documented invoice-statistics request. Retry provider synchronization.',
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
    addressValidationStatus: validationStatus,
    addressMarkedValid: markValidAddress,
    addressReadbackStatus,
    addressReadbackMismatchFields,
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
