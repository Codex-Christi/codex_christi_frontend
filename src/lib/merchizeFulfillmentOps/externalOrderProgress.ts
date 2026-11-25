import { object } from './customerTracking';

export type ExternalOrderProgressReference = {
  merchizeExternalOrderNumber: string;
  merchizeIdentifier?: string | null;
  merchizeOrderCode?: string | null;
};

const customerMilestones = ['delivered', 'shipment_started', 'in_production'] as const;

export function providerTimestamp(value: unknown) {
  return typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
    Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;
}

export function confirmedMerchizePushTime(payload: unknown, observedAt: Date) {
  const envelope = object(payload);
  const data = envelope?.success === true ? object(envelope.data) : null;
  if (!data || data.is_failed === true || (data.is_pushed !== true && data.pushed !== true)) {
    return null;
  }
  const at = providerTimestamp(data.push_at);
  return at && Date.parse(at) <= observedAt.getTime() ? new Date(at) : null;
}

export function knownMerchizeOrderCode(reference: ExternalOrderProgressReference) {
  const code = reference.merchizeOrderCode;
  return code && code !== reference.merchizeExternalOrderNumber ? code : null;
}

export function matchExternalOrderProgress(
  payload: unknown,
  reference: ExternalOrderProgressReference,
) {
  const envelope = object(payload);
  if (envelope?.success !== true || !Array.isArray(envelope.data)) return null;
  const code = knownMerchizeOrderCode(reference);
  const matches = envelope.data
    .map(object)
    .filter(
      (row) =>
        row?.external_number === reference.merchizeExternalOrderNumber &&
        (!reference.merchizeIdentifier || row.identifier === reference.merchizeIdentifier) &&
        (!code || row.code === code),
    );
  return matches.length === 1 ? matches[0] : null;
}

export function readExternalOrderProgress(
  payload: unknown,
  reference: ExternalOrderProgressReference,
) {
  const progress = matchExternalOrderProgress(payload, reference)?.order_progress;
  if (!Array.isArray(progress) || !progress.length) return null;

  const events = progress.map(object);
  if (events.some((event) => typeof event?.event !== 'string' || typeof event.status !== 'string'))
    return null;
  const completedAt: Partial<Record<(typeof customerMilestones)[number], Date>> = {};
  const completed = customerMilestones.filter((name) => {
    const step = uniqueProgressEvent(events, name);
    if (step?.status !== 'done') return false;
    const actual = providerTimestamp(step.actual);
    if (actual) completedAt[name] = new Date(actual);
    return true;
  });
  const pending = events.find((event) => event?.status !== 'done');
  return {
    completed,
    completedAt,
    status: pending ? `${pending.event}:${pending.status}`.slice(0, 100) : 'done',
  };
}

export function uniqueProgressEvent(events: unknown, name: string) {
  if (!Array.isArray(events)) return null;
  const matching = events.map(object).filter((event) => event?.event === name);
  return matching.length === 1 ? matching[0] : null;
}
