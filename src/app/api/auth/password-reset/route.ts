import { NextResponse } from 'next/server';
import { z } from 'zod';
import { emailSchema, otpSchema, newPasswordSchema } from '@/lib/formSchemas/auth-fields';
import { isSameOriginMutation } from '@/lib/auth/request-origin';
import {
  submitRegistrationRequest,
  type RegistrationResult,
} from '@/lib/auth/registration-request';
import { clearLogoutCookies } from '@/lib/auth/logout-cookies';
import { getServerRefreshToken } from '@/lib/session/server-session';
import { cancelSessionRefresh } from '@/lib/session/session-refresh';

const schema = z
  .object({ email: emailSchema, otp: otpSchema, password: newPasswordSchema })
  .strict();

const reply = (result: RegistrationResult, status: number) =>
  NextResponse.json(result, { status, headers: { 'Cache-Control': 'private, no-store' } });

async function readInput(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing request body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 8 * 1024) {
      await reader.cancel();
      throw new RangeError('Request body is too large');
    }
    chunks.push(part.value);
  }
  return schema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request))
    return reply({ success: false, error: 'Request not allowed.' }, 403);
  let input;
  try {
    input = await readInput(request);
  } catch (error) {
    return reply(
      { success: false, error: 'Check your email, code and new password.' },
      error instanceof RangeError ? 413 : 400,
    );
  }
  const result = await submitRegistrationRequest(
    '/account/forgotten-password-reset',
    input,
    'reset-password',
  );
  const response = reply(result, result.success ? 200 : (result.status ?? 400));
  if (!result.success) return response;
  const refresh = await getServerRefreshToken();
  if (refresh) cancelSessionRefresh(refresh);
  return clearLogoutCookies(response, request.headers);
}
