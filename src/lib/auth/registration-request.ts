import 'server-only';

import { headers } from 'next/headers';
import { djangoRequest, readDjangoJson, safeDjangoMessage } from '../django/request';
import { asRecord } from '../session/django-auth-response';
import { allowAuthAttempt } from './rate-limit';

export type RegistrationResult =
  { success: true; email?: string } | { success: false; error: string; status?: number };

export async function submitRegistrationRequest(
  path: string,
  data: Record<string, string>,
  scope: string,
  resend = false,
): Promise<RegistrationResult> {
  const h = await headers();
  if (
    !allowAuthAttempt('auth-ip', h.get('x-real-ip') ?? 'unknown', 40, 60_000) ||
    !allowAuthAttempt(
      scope,
      data.email.toLowerCase(),
      resend ? 1 : 10,
      resend ? 30_000 : 5 * 60_000,
    )
  ) {
    return {
      success: false,
      error: 'Too many attempts. Please wait before trying again.',
      status: 429,
    };
  }
  try {
    const response = await djangoRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    });
    const payload = await readDjangoJson(response);
    // Code-request responses must not disclose whether an email has an account.
    if (resend && response.status === 404) return { success: true };
    if (!response.ok || asRecord(payload)?.success !== true)
      return {
        success: false,
        status: response.status >= 400 ? response.status : 400,
        error:
          response.status >= 500
            ? 'The service is temporarily unavailable. Please try again.'
            : safeDjangoMessage(payload, 'Check the details and try again.'),
      };
    return { success: true, ...(scope === 'registration' ? { email: data.email } : {}) };
  } catch {
    return {
      success: false,
      error: 'The service is temporarily unavailable. Please try again.',
      status: 503,
    };
  }
}
