export type ShipmentPackage = {
  id: string;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  delivered: boolean;
};

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

/** Delivery is explicit carrier evidence, never "fulfilled" or a completed payment workflow. */
export function shipmentPackages(payload: unknown, reference: string): ShipmentPackage[] {
  return matchingShipmentRecords(payload, reference)
    .flatMap((row) => {
      const values = Array.isArray(row.packages)
        ? row.packages
        : Array.isArray(row.package_progresses)
          ? row.package_progresses
          : [row];
      return values.slice(0, 50).flatMap((value, index) => {
        const item = object(value);
        if (!item) return [];
        const tracking = object(item.tracking);
        const carrier = object(item.carrier);
        const events = Array.isArray(item.progress) ? item.progress : [];
        const delivered =
          normalized(item.status) === 'delivered' ||
          events.some((event) => {
            const entry = object(event);
            return normalized(entry?.event) === 'delivered' && normalized(entry?.status) === 'done';
          });
        const number = text(
          item.tracking_number ?? item.tracking_code ?? tracking?.tracking_number,
        );
        if (!number && !events.length && !item.package_id && values[0] === row) return [];
        return [
          {
            id: text(item.package_id ?? item.id) ?? `${reference}-${index}`,
            carrier: text(carrier?.name ?? item.carrier_name ?? item.carrier, 80),
            trackingNumber: number,
            trackingUrl: trackingLink(item.tracking_url ?? tracking?.tracking_url),
            status: delivered ? 'Delivered' : shipmentLabel(item.status),
            delivered,
          },
        ];
      });
    })
    .slice(0, 50);
}

export function shipmentSummary(payload: unknown, reference: string) {
  const rows = matchingShipmentRecords(payload, reference);
  const packages = shipmentPackages(payload, reference);
  const complete =
    rows.length > 0 &&
    rows.every((row) => {
      const count = row.package_count ?? row.total_packages;
      const source = Array.isArray(row.packages)
        ? row.packages
        : Array.isArray(row.package_progresses)
          ? row.package_progresses
          : [row];
      return (
        rows.length === 1 &&
        source.length === packages.length &&
        typeof count === 'number' &&
        Number.isInteger(count) &&
        count > 0 &&
        count <= 50 &&
        count === packages.length
      );
    });
  const delivered = packages.length > 0 && packages.every((item) => item.delivered);
  return {
    packages,
    label: delivered
      ? complete
        ? 'Delivered'
        : 'Listed packages delivered'
      : packages.some((item) => ['On the way', 'Out for delivery'].includes(item.status))
        ? 'On the way'
        : packages.some((item) => item.trackingNumber)
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
