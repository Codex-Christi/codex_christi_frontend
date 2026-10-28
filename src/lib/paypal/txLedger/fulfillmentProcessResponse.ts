import 'server-only';
import { z } from 'zod';
import { DjangoOrderError, djangoReference } from './djangoOrderContract';

type JsonRecord = Record<string, unknown>;

const ACCEPTED_DJANGO_FULFILLMENT_INFO_MESSAGE = 'order created but details not available';

const responseSchema = z.looseObject({
  status: z.union([z.literal(200), z.literal(201)]),
  success: z.literal(true),
  message: z.string().optional(),
  data: z.looseObject({
    id: z.uuid(),
    order_payment_custom_id: djangoReference,
    order_intent_id: djangoReference.nullable().optional(),
    order_intent_order_id: djangoReference.nullable().optional(),
    provider_order_id: djangoReference.nullable().optional(),
    provider_order_code: djangoReference.nullable().optional(),
    processing_status: z.enum([
      'pending',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'completed',
      'failed',
    ]),
    request_data: z.record(z.string(), z.unknown()).optional(),
    response_data: z.record(z.string(), z.unknown()).nullable().optional(),
    error_message: z.string().nullable().optional(),
    retry_count: z.number().int().nonnegative().optional(),
    date_created: z.string().optional(),
    date_updated: z.string().optional(),
  }),
});

export function parseDjangoFulfillmentProcessResponse(
  value: unknown,
  expected: { customId: string; intentUuid?: string | null; orderId?: string | null },
) {
  const parsed = responseSchema.safeParse(value);
  const data = parsed.success ? parsed.data.data : null;
  if (
    !parsed.success ||
    !data ||
    data.order_payment_custom_id !== expected.customId ||
    (expected.intentUuid && data.order_intent_id && data.order_intent_id !== expected.intentUuid) ||
    (expected.orderId &&
      data.order_intent_order_id &&
      data.order_intent_order_id !== expected.orderId)
  ) {
    throw new DjangoOrderError({
      code: 'INVALID_DJANGO_FULFILLMENT_RESPONSE',
      message:
        'The Django fulfillment reply could not be matched to this paid order. Review it before retrying.',
      outcome: 'uncertain',
      responsePayload: value,
    });
  }
  return parsed.data;
}

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
  const attempt = asRecord(response?._nextDjangoAttempt);

  return (
    (response?._nextDjangoAttempt === undefined ||
      (attempt?.version === 1 &&
        attempt.operation === 'fulfillment_handoff' &&
        attempt.outcome === 'acknowledged')) &&
    (status === 200 || status === 201) &&
    response?.success === true &&
    normalizeFulfillmentMessage(data?.processing_status) === 'completed' &&
    (!errorMessage || errorMessage === ACCEPTED_DJANGO_FULFILLMENT_INFO_MESSAGE)
  );
}
