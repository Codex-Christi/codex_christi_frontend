import { asRecord } from './merchizeMapper';
import { knownMerchizeOrderCode, type ExternalOrderProgressReference } from './externalOrderProgress';

export type SupplierInvoiceState = 'paid' | 'unpaid' | 'available' | 'placeholder' | 'provider_error';

export function readSupplierInvoice(payload: unknown, reference?: ExternalOrderProgressReference) {
  const envelope = asRecord(payload);
  if (envelope?.success !== true || !Array.isArray(envelope.data)) {
    return { state: 'provider_error' as const, paidAt: null };
  }

  const rows = envelope.data.map(asRecord);
  const code = reference ? knownMerchizeOrderCode(reference) : null;
  const matching = reference
    ? rows.filter((row) => row?.external_number === reference.merchizeExternalOrderNumber &&
        (!reference.merchizeIdentifier || row.identifier === reference.merchizeIdentifier) &&
        (!code || row.code === code))
    : rows;
  if (matching.length > 1 || (rows.length && matching.length !== 1) ||
    (matching.length === 1 && !matching[0])) {
    return { state: 'provider_error' as const, paidAt: null };
  }

  const value = matching[0]?.fulfillment_cost;
  const cost = asRecord(value);
  const status = typeof cost?.status === 'string' ? cost.status.trim().toLowerCase() : '';
  const paidAt = typeof cost?.paid_at === 'string' && Number.isFinite(Date.parse(cost.paid_at))
    ? new Date(cost.paid_at).toISOString()
    : null;
  const state: SupplierInvoiceState = status === 'paid'
    ? 'paid'
    : ['pending', 'unpaid'].includes(status)
      ? 'unpaid'
      : (cost && Object.keys(cost).length) || (typeof value === 'number' && value > 0)
        ? 'available'
        : 'placeholder';
  return { state, paidAt: state === 'paid' ? paidAt : null };
}
