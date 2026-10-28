'use client';

type AdminAuthResult = { success: true } | { success: false; error: string };

export async function postAdminAuth(
  action: 'lock' | 'unlock' | 'password',
  input?: unknown,
): Promise<AdminAuthResult> {
  try {
    const response = await fetch(`/next-api/admin/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
      signal: AbortSignal.timeout(10_000),
    });
    const result: unknown = await response.json();
    if (result && typeof result === 'object' && 'success' in result) {
      if (response.ok && result.success === true) return { success: true };
      if (result.success === false && 'error' in result && typeof result.error === 'string')
        return { success: false, error: result.error };
    }
  } catch {
    // An uncertain password-change response must never trigger an automatic resubmission.
  }
  return {
    success: false,
    error:
      action === 'password'
        ? 'The change could not be confirmed. Try unlocking with your new password before submitting again.'
        : 'The request could not be confirmed. Please try again.',
  };
}
