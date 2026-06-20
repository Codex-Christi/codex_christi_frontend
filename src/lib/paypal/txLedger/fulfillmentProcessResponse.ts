import 'server-only';

type JsonRecord = Record<string, unknown>;

const ACCEPTED_DJANGO_FULFILLMENT_INFO_MESSAGE = 'order created but details not available';

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
  return null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeFulfillmentMessage(value: unknown) {
  return asString(value)?.trim().toLowerCase() ?? '';
}

export function isAcceptedDjangoFulfillmentProcessResponse(payload: unknown) {
  const response = asRecord(payload);
  const data = asRecord(response?.data);
  const status = asNumber(response?.status);
  const errorMessage = normalizeFulfillmentMessage(data?.error_message);

  return (
    (status === 200 || status === 201) &&
    response?.success === true &&
    normalizeFulfillmentMessage(data?.processing_status) === 'completed' &&
    (!errorMessage || errorMessage === ACCEPTED_DJANGO_FULFILLMENT_INFO_MESSAGE)
  );
}
