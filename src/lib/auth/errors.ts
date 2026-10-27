export type AuthFailureCode =
  'sign_in_required' | 'unavailable' | 'forbidden' | 'not_found' | 'invalid_input';

export class AccountRequestError extends Error {
  constructor(
    public code: AuthFailureCode,
    message: string,
    public status = 503,
  ) {
    super(message);
    this.name = 'AccountRequestError';
  }
}

export type AccountResult<T> =
  { success: true; data: T } | { success: false; error: string; code: AuthFailureCode };

export function accountFailure(error: unknown): AccountResult<never> {
  return error instanceof AccountRequestError
    ? { success: false, error: error.message, code: error.code }
    : {
        success: false,
        error: 'The service is temporarily unavailable. Please try again.',
        code: 'unavailable',
      };
}
