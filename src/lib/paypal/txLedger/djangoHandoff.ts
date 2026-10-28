import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { extractMerchizeExternalOrderNumberFromDjangoProcessResponse } from '@/lib/merchizeFulfillmentOps/merchizeMapper';
import { isAcceptedDjangoFulfillmentProcessResponse } from './fulfillmentProcessResponse';
import { DjangoOrderError, djangoOrderFailure } from './djangoOrderContract';

type Operation = 'payment_save' | 'fulfillment_handoff';
type JsonRecord = Record<string, unknown>;
const markerKey = '_nextDjangoAttempt';
const attemptSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  operation: z.enum(['payment_save', 'fulfillment_handoff']),
  startedAt: z.iso.datetime(),
  outcome: z.enum(['started', 'acknowledged', 'not_sent', 'rejected', 'uncertain']),
  finishedAt: z.iso.datetime().optional(),
  code: z.string().optional(),
  httpStatus: z.number().int().optional(),
});

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function operationReview(
  operation: Operation,
  evidence: unknown,
  checkpoint: boolean,
  lastErrorCode?: string | null,
) {
  const payload = record(evidence);
  const marker = payload?.[markerKey];
  let blocked;
  if (marker !== undefined) {
    const parsed = attemptSchema.safeParse(marker);
    blocked =
      !parsed.success ||
      parsed.data.operation !== operation ||
      (!['not_sent', 'rejected'].includes(parsed.data.outcome) &&
        !(parsed.data.outcome === 'acknowledged' && checkpoint));
  } else {
    const legacyFailure =
      operation === 'payment_save'
        ? ['DJANGO_PAYMENT_SAVE_FAILED', 'DJANGO_PAYMENT_SAVE_REVIEW_REQUIRED'].includes(
            lastErrorCode ?? '',
          )
        : ['DJANGO_FULFILLMENT_HANDOFF_FAILED', 'DJANGO_FULFILLMENT_REVIEW_REQUIRED'].includes(
            lastErrorCode ?? '',
          );
    blocked =
      !checkpoint &&
      (legacyFailure || (evidence != null && payload?.source !== 'local_validation'));
  }
  return blocked
    ? {
        operation,
        code:
          operation === 'payment_save'
            ? 'DJANGO_PAYMENT_SAVE_REVIEW_REQUIRED'
            : 'DJANGO_FULFILLMENT_REVIEW_REQUIRED',
        message: `${operation === 'payment_save' ? 'Django payment save' : 'Django fulfillment handoff'} may already have run. Verify its existing record before retrying; this POST will not be replayed.`,
      }
    : null;
}

export function getDjangoHandoffReview(row: {
  djangoPaymentSaveCustomId?: string | null;
  djangoPaymentSaveResponsePayload?: unknown;
  merchizeFulfillmentResponsePayload?: unknown;
  djangoOrderIntentOrderId?: string | null;
  lastErrorCode?: string | null;
}) {
  const accepted = isAcceptedDjangoFulfillmentProcessResponse(
    row.merchizeFulfillmentResponsePayload,
  );
  const fulfillmentCheckpoint =
    accepted &&
    Boolean(
      extractMerchizeExternalOrderNumberFromDjangoProcessResponse(
        row.merchizeFulfillmentResponsePayload,
        row.djangoOrderIntentOrderId,
      ),
    );
  return (
    operationReview(
      'payment_save',
      row.djangoPaymentSaveResponsePayload,
      Boolean(row.djangoPaymentSaveCustomId),
      row.lastErrorCode,
    ) ??
    operationReview(
      'fulfillment_handoff',
      row.merchizeFulfillmentResponsePayload,
      fulfillmentCheckpoint,
      row.lastErrorCode,
    )
  );
}

/** The started marker is durable before dispatch; only commit may acknowledge the write. */
export async function runDjangoHandoff<T>({
  operation,
  previousEvidence,
  lastErrorCode,
  persistEvidence,
  send,
  response,
  commit,
}: {
  operation: Operation;
  previousEvidence: unknown;
  lastErrorCode?: string | null;
  persistEvidence: (evidence: JsonRecord) => Promise<void>;
  send: () => Promise<T>;
  response: (value: T) => unknown;
  commit: (value: T, evidence: JsonRecord) => Promise<void>;
}) {
  const review = operationReview(operation, previousEvidence, false, lastErrorCode);
  if (review) throw new DjangoOrderError({ ...review, outcome: 'uncertain' });
  const attempt = {
    version: 1 as const,
    id: randomUUID(),
    operation,
    startedAt: new Date().toISOString(),
  };
  const evidenceFor = (
    payload: unknown,
    state: Omit<z.infer<typeof attemptSchema>, keyof typeof attempt>,
  ) => ({
    ...record(payload),
    [markerKey]: { ...attempt, ...state },
  });
  try {
    await persistEvidence(evidenceFor(null, { outcome: 'started' }));
  } catch (error) {
    throw new DjangoOrderError(djangoOrderFailure(error, 'not_sent'));
  }
  let value: T;
  try {
    value = await send();
  } catch (error) {
    const failure = djangoOrderFailure(error);
    await persistEvidence(
      evidenceFor(failure.responsePayload, {
        outcome: failure.outcome,
        code: failure.code,
        ...(failure.httpStatus === undefined ? {} : { httpStatus: failure.httpStatus }),
        finishedAt: new Date().toISOString(),
      }),
    );
    throw error instanceof DjangoOrderError ? error : new DjangoOrderError(failure);
  }
  const evidence = evidenceFor(response(value), {
    outcome: 'acknowledged',
    finishedAt: new Date().toISOString(),
  });
  // A failed commit deliberately leaves the durable started marker, never a retryable rejection.
  await commit(value, evidence);
  return value;
}
