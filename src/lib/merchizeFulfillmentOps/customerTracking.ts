export type ShipmentPackage = {
  id: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  delivered: boolean;
};

export const VERIFIED_MERCHIZE_DELIVERY_STATUS = 'delivered_verified';
const MAX_PACKAGES = 50;

export function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, limit = 120) {
  return typeof value === 'string' &&
    value.trim() &&
    value.length <= limit &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value.trim()
    : null;
}

function normalized(value: unknown) {
  return (
    text(value)
      ?.toLowerCase()
      .replace(/[\s-]+/gu, '_') ?? ''
  );
}

export function trackingLink(value: unknown) {
  try {
    const url = new URL(text(value, 2048) ?? '');
    const domains = [
      'ups.com',
      'usps.com',
      'fedex.com',
      'dhl.com',
      'dhl.de',
      '17track.net',
      'aftership.com',
      'parcelsapp.com',
    ];
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      domains.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function matchingShipmentRecords(payload: unknown, reference: string) {
  const root = object(payload);
  if (root?.success !== true) return [];
  const values = Array.isArray(root.data) ? root.data : [root.data];
  return values.flatMap((value) => {
    const row = object(value);
    if (!row) return [];
    const references = [row.external_number, row.external_order_number].filter(
      (value) => value != null,
    );
    if (references.some((value) => text(value) !== reference)) return [];
    // A single, scoped response may omit its reference; a mixed result must identify each order.
    return references.length || values.length === 1 ? [row] : [];
  });
}

export function shipmentLabel(value: unknown) {
  switch (normalized(value)) {
    case 'delivered':
    case VERIFIED_MERCHIZE_DELIVERY_STATUS:
      return 'Delivered';
    case 'in_transit':
    case 'shipped':
      return 'On the way';
    case 'out_for_delivery':
      return 'Out for delivery';
    case 'label_created':
    case 'pre_transit':
      return 'Shipping label created';
    case 'cancelled':
    case 'canceled':
      return 'Shipment cancelled';
    case 'exception':
    case 'failed_attempt':
    case 'returned_to_sender':
      return 'Delivery needs attention';
    case 'fulfilled':
    case 'tracking_available':
      return 'Tracking available';
    case 'pending':
    case 'processing':
    case 'preparing':
      return 'Preparing your order';
    default:
      return 'Awaiting an update';
  }
}

function packageRows(row: Record<string, unknown>): unknown[] {
  if (Array.isArray(row.packages)) return row.packages;
  if (Array.isArray(row.package_progresses)) return row.package_progresses;
  return [row];
}

function packageId(item: Record<string, unknown>) {
  return text(item._id) ?? text(item.package_id) ?? text(item.id);
}

function parsePackage(value: unknown, fallbackId: string): ShipmentPackage | null {
  const item = object(value);
  if (!item) return null;
  const id = packageId(item);
  const tracking = object(item.tracking);
  const carrier = object(item.carrier);
  const events = Array.isArray(item.progress) ? item.progress : [];
  // The seller's fulfillment state is not a carrier event. Prefer the explicit shipment state.
  const shipmentStatus = normalized(item.shipment_status);
  const legacyStatus = normalized(item.status);
  const delivered =
    item.shipment_status != null
      ? shipmentStatus === 'delivered'
      : legacyStatus === 'delivered' ||
        events.some((event) => {
          const entry = object(event);
          return normalized(entry?.event) === 'delivered' && normalized(entry?.status) === 'done';
        });
  const number = text(item.tracking_number ?? item.tracking_code ?? tracking?.tracking_number);
  const url = trackingLink(item.tracking_url ?? tracking?.tracking_url);
  if (!number && !url && !events.length && !id) return null;
  return {
    id: id ?? fallbackId,
    carrier:
      text(item.tracking_company, 80) ??
      text(carrier?.name ?? item.carrier_name ?? item.carrier, 80),
    trackingNumber: number,
    trackingUrl: url,
    status: delivered ? 'Delivered' : shipmentLabel(shipmentStatus || legacyStatus),
    delivered,
  };
}

/** Only bind evidence from the single-order tracking endpoint, never from a batch tracking reply. */
export function scopeSingleOrderTracking(
  payload: unknown,
  order: {
    merchizeExternalOrderNumber: string;
    merchizeIdentifier: string | null;
    merchizeOrderCode?: string | null;
  },
) {
  const envelope = object(payload);
  if (envelope?.success !== true) return null;
  const values = Array.isArray(envelope.data) ? envelope.data : [envelope.data];
  const reference = order.merchizeExternalOrderNumber;
  const rows = values.map(object);
  const matchesScope = (row: Record<string, unknown>) => {
    const refs = [row.external_number, row.external_order_number].filter((value) => value != null);
    return (
      refs.every((value) => value === reference) &&
      (!row.identifier ||
        !order.merchizeIdentifier ||
        row.identifier === order.merchizeIdentifier) &&
      (!row.code || !order.merchizeOrderCode || row.code === order.merchizeOrderCode)
    );
  };
  if (
    !reference ||
    !rows.length ||
    rows.some(
      (row) =>
        !row ||
        !matchesScope(row) ||
        (!row.external_number &&
          !row.external_order_number &&
          !order.merchizeIdentifier &&
          !order.merchizeOrderCode),
    )
  )
    return null;

  const accepted = rows.filter((row): row is Record<string, unknown> => row !== null);
  const raw = accepted.flatMap(packageRows);
  const ids = new Set<string>();
  if (
    !raw.length ||
    raw.length > MAX_PACKAGES ||
    raw.some((value, index) => {
      const item = object(value);
      if (!item || !matchesScope(item) || !parsePackage(item, `${reference}-${index}`)) return true;
      const id = packageId(item);
      if (id && ids.has(id)) return true;
      if (id) ids.add(id);
      return false;
    })
  )
    return null;

  const scoped = accepted.map((row) => ({ ...row, external_number: reference }));
  return { success: true, data: Array.isArray(envelope.data) ? scoped : scoped[0] };
}

export function shipmentSummary(
  payload: unknown,
  reference: string,
  { orderDeliveryConfirmed = false }: { orderDeliveryConfirmed?: boolean } = {},
) {
  const data = object(payload)?.data;
  const rows = matchingShipmentRecords(payload, reference);
  const raw = rows.flatMap(packageRows);
  const packages = raw.slice(0, MAX_PACKAGES).flatMap((value, index) => {
    const pack = parsePackage(value, `${reference}-${index}`);
    return pack ? [pack] : [];
  });
  const counts = rows.flatMap((row) =>
    [row.package_count, row.total_packages].filter((count) => count != null),
  );
  const ids = raw.slice(0, MAX_PACKAGES).map((value) => packageId(object(value) ?? {}));
  const complete =
    rows.length === (Array.isArray(data) ? data.length : 1) &&
    raw.length === packages.length &&
    ids.every(Boolean) &&
    new Set(ids).size === packages.length &&
    (counts.length ? counts.every((count) => count === packages.length) : orderDeliveryConfirmed);
  const delivered = packages.length > 0 && packages.every((item) => item.delivered);
  const hasTracking = packages.some((pack) => pack.trackingNumber || pack.trackingUrl);
  return {
    packages,
    deliveryStatus:
      complete && delivered
        ? VERIFIED_MERCHIZE_DELIVERY_STATUS
        : hasTracking
          ? 'tracking_available'
          : null,
    label: delivered
      ? complete
        ? 'Delivered'
        : 'Listed packages delivered'
      : packages.some((item) => ['On the way', 'Out for delivery'].includes(item.status))
        ? 'On the way'
        : hasTracking
          ? 'Tracking available'
          : 'Tracking not available yet',
    delivered: complete && delivered,
  };
}

export function stampShipmentSnapshot(payload: unknown, now = new Date()) {
  return { ...object(payload), _nextFetchedAt: now.toISOString() };
}

export function snapshotCheckedAt(payload: unknown) {
  const value = object(payload)?._nextFetchedAt;
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}
