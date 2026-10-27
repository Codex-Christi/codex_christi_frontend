'use server';

import { headers } from 'next/headers';
import { signInSchema } from '@/lib/formSchemas/signInSchema';
import { createSession, refreshSession } from '@/lib/session/main-session';
import { getServerSessionState, getServerUserID } from '@/lib/session/server-session';
import { asRecord, getNestedAuthToken } from '@/lib/session/django-auth-response';
import { djangoRequest, readDjangoJson } from '@/lib/django/request';
import { allowAuthAttempt } from '@/lib/auth/rate-limit';

export interface AuthSessionState {
  isAuthenticated: boolean;
  user_id: string | null;
  expiresAt?: number | null;
  status?: 'authenticated' | 'anonymous' | 'unavailable';
}
export type LoginResult =
  { success: true; sessionState: AuthSessionState } | { success: false; error: string };

export async function loginUser(input: unknown): Promise<LoginResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Enter a valid email and password.' };
  const h = await headers();
  if (
    !allowAuthAttempt('login-ip', h.get('x-real-ip') ?? 'unknown', 30, 60_000) ||
    !allowAuthAttempt('login-email', parsed.data.email.toLowerCase(), 15, 5 * 60_000)
  ) {
    return { success: false, error: 'Too many sign-in attempts. Please wait a few minutes.' };
  }
  try {
    const response = await djangoRequest('/auth/user-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(parsed.data),
    });
    const payload = await readDjangoJson(response);
    if (!response.ok || asRecord(payload)?.success !== true) {
      return {
        success: false,
        error:
          response.status >= 500
            ? 'Sign-in is temporarily unavailable. Please try again.'
            : 'Check your email and password. Your email must be verified before signing in.',
      };
    }
    const access = getNestedAuthToken(payload, 'access');
    const refresh = getNestedAuthToken(payload, 'refresh');
    if (!access || !refresh) throw new Error('Missing tokens');
    await createSession(access, refresh);
    return { success: true, sessionState: await getAuthSessionState() };
  } catch {
    return { success: false, error: 'Sign-in is temporarily unavailable. Please try again.' };
  }
}

export async function getUserID() {
  return getServerUserID();
}

export async function getAuthSessionState(): Promise<AuthSessionState> {
  let session = await getServerSessionState();
  if (!session.isAuthenticated || session.expiresSoon) {
    const result = await refreshSession();
    if (
      !result.success &&
      result.unavailable &&
      session.isAuthenticated &&
      session.expiresAt &&
      session.expiresAt > Date.now()
    ) {
      return {
        isAuthenticated: true,
        user_id: session.userID,
        expiresAt: session.expiresAt,
        status: 'authenticated',
      };
    }
    if (!result.success)
      return {
        isAuthenticated: false,
        user_id: null,
        expiresAt: null,
        status: result.unavailable ? 'unavailable' : 'anonymous',
      };
    session = await getServerSessionState();
  }
  return {
    isAuthenticated: session.isAuthenticated,
    user_id: session.userID,
    expiresAt: session.expiresAt,
    status: session.isAuthenticated ? 'authenticated' : 'anonymous',
  };
}
