import { object } from './customerTracking';

export type ExternalOrderProgressReference = {
  merchizeExternalOrderNumber: string;
  merchizeIdentifier?: string | null;
  merchizeOrderCode?: string | null;
};

const customerMilestones = ['delivered', 'shipment_started', 'in_production'] as const;

export function knownMerchizeOrderCode(reference: ExternalOrderProgressReference) {
  const code = reference.merchizeOrderCode;
  return code && code !== reference.merchizeExternalOrderNumber ? code : null;
}

export function readExternalOrderProgress(
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
  const progress = matches[0]?.order_progress;
  if (matches.length !== 1 || !Array.isArray(progress) || !progress.length) return null;

  const events = progress.map(object);
  if (events.some((event) => typeof event?.event !== 'string' || typeof event.status !== 'string'))
    return null;
  const completedAt: Partial<Record<(typeof customerMilestones)[number], Date>> = {};
  const completed = customerMilestones.filter((name) => {
    const matching = events.filter((event) => event?.event === name);
    if (matching.length !== 1 || matching[0]?.status !== 'done') return false;
    const actual = matching[0].actual;
    if (typeof actual === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(actual) && Number.isFinite(Date.parse(actual))) {
      completedAt[name] = new Date(actual);
    }
    return true;
  });
  const pending = events.find((event) => event?.status !== 'done');
  return {
    completed,
    completedAt,
    status: pending ? `${pending.event}:${pending.status}`.slice(0, 100) : 'done',
  };
}
