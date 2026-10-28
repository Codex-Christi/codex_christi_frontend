import { z } from 'zod';

export const djangoReference = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => value === value.trim())
  .regex(/^[^\u0000-\u001f\u007f]+$/u);

export type DjangoOrderFailure = {
  code: string;
  message: string;
  outcome: 'not_sent' | 'rejected' | 'uncertain';
  httpStatus?: number;
  responsePayload?: unknown;
};

export class DjangoOrderError extends Error {
  constructor(readonly failure: DjangoOrderFailure) {
    super(failure.message);
    this.name = 'DjangoOrderError';
  }
}

export function djangoOrderFailure(
  error: unknown,
  outcome: 'not_sent' | 'uncertain' = 'uncertain',
): DjangoOrderFailure {
  return error instanceof DjangoOrderError
    ? error.failure
    : {
        code: outcome === 'not_sent' ? 'DJANGO_REQUEST_NOT_SENT' : 'DJANGO_OUTCOME_UNCERTAIN',
        message:
          outcome === 'not_sent'
            ? 'The Django request could not be prepared and was not sent.'
            : 'The Django operation could not be verified. Review this paid order before retrying.',
        outcome,
      };
}
