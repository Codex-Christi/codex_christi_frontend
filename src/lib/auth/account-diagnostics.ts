import 'server-only';

import { ZodError } from 'zod';
import { AccountRequestError, accountFailure } from './errors';

export function accountActionFailure(operation: string, error: unknown) {
  if (!(error instanceof AccountRequestError)) {
    const cause =
      error instanceof Error &&
      error.cause &&
      typeof error.cause === 'object' &&
      'code' in error.cause
        ? error.cause.code
        : undefined;
    console.warn(
      '[account] Request failed',
      JSON.stringify({
        operation,
        kind:
          error instanceof ZodError
            ? 'invalid_backend_data'
            : error instanceof SyntaxError
              ? 'invalid_backend_json'
              : error instanceof Error && /Timeout|Abort/.test(error.name)
                ? 'backend_timeout'
                : 'backend_request_failed',
        ...(typeof cause === 'string' && /^[A-Z_]{1,40}$/.test(cause)
          ? { networkCode: cause }
          : {}),
        ...(error instanceof ZodError
          ? {
              fields: error.issues
                .slice(0, 12)
                .map((issue) => ({ path: issue.path.join('.'), code: issue.code })),
            }
          : {}),
      }),
    );
  }
  return accountFailure(error);
}
