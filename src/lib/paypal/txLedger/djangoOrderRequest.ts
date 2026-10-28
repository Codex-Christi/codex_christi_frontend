import 'server-only';
import { generateSignatureHeaders } from '@/lib/hooks/shopHooks/checkout/helpers/generateSignatureHeaders';
import { getServerDjangoApiBaseUrl } from '@/lib/django/getServerDjangoApiBaseUrl';
import { DjangoOrderError } from './djangoOrderContract';

const MAX_RESPONSE_BYTES = 256 * 1024;
const REJECTION_STATUSES = new Set([401, 403, 404, 405, 415, 422, 429]);
const VALIDATION_CODES = new Set([
  'required',
  'blank',
  'invalid',
  'max_length',
  'min_length',
  'max_value',
  'min_value',
  'invalid_choice',
]);

function isValidationRejection(payload: unknown) {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('success' in payload) ||
    payload.success !== false ||
    !('errors' in payload) ||
    !Array.isArray(payload.errors) ||
    !payload.errors.length
  )
    return false;
  return payload.errors.every((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return false;
    const error = entry as Record<string, unknown>;
    return (
      typeof error.field_name === 'string' &&
      Boolean(error.field_name.trim()) &&
      typeof error.code === 'string' &&
      VALIDATION_CODES.has(error.code)
    );
  });
}

async function readResponse(response: Response) {
  if (!response.body) throw new Error('Missing response body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('Response too large');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Never retry a dispatched POST here: a lost reply does not prove the write failed. */
export async function postDjangoOrder(endpoint: string, payload: unknown) {
  let dispatched = false;
  let httpStatus: number | undefined;
  try {
    const url = `${getServerDjangoApiBaseUrl()}${endpoint}`;
    const headers = await generateSignatureHeaders();
    const body = JSON.stringify(payload);
    dispatched = true;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    httpStatus = response.status;
    const responsePayload = await readResponse(response);
    if (response.ok && response.status !== 200 && response.status !== 201) {
      throw new DjangoOrderError({
        code: 'DJANGO_OUTCOME_UNCERTAIN',
        message:
          'Django returned an undocumented success status. Review the existing record before retrying.',
        outcome: 'uncertain',
        httpStatus,
        responsePayload,
      });
    }
    if (!response.ok) {
      const rejected =
        (REJECTION_STATUSES.has(response.status) ||
          (response.status === 400 && isValidationRejection(responsePayload))) &&
        !(
          responsePayload &&
          typeof responsePayload === 'object' &&
          'success' in responsePayload &&
          responsePayload.success === true
        );
      throw new DjangoOrderError({
        code: rejected ? 'DJANGO_REQUEST_REJECTED' : 'DJANGO_OUTCOME_UNCERTAIN',
        message: rejected
          ? `Django rejected the request (HTTP ${response.status}). Correct the issue before retrying.`
          : `Django returned HTTP ${response.status}; its write outcome requires review before retrying.`,
        outcome: rejected ? 'rejected' : 'uncertain',
        httpStatus,
        responsePayload,
      });
    }
    return responsePayload;
  } catch (error) {
    if (error instanceof DjangoOrderError) throw error;
    throw new DjangoOrderError({
      code: dispatched ? 'DJANGO_OUTCOME_UNCERTAIN' : 'DJANGO_REQUEST_NOT_SENT',
      message: dispatched
        ? 'Django may have received the request, but its reply could not be verified. Review this paid order before retrying.'
        : 'The Django request could not be prepared and was not sent.',
      outcome: dispatched ? 'uncertain' : 'not_sent',
      httpStatus,
    });
  }
}
