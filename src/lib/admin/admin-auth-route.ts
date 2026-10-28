import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSameOriginMutation } from '../auth/request-origin';
import { AdminCredentialError } from './admin-credentials';
import { isAdminActionAuthError } from './require-admin';

export const adminAuthHeaders = { 'Cache-Control': 'private, no-store' };

// Bound password work across Next's separate route bundles on the small VPS.
const budgetKey = Symbol.for('codexchristi.admin-credential-budget.v1');
const shared = globalThis as typeof globalThis & { [budgetKey]?: { active: number } };
const budget = (shared[budgetKey] ??= { active: 0 });

export function adminAuthReply(body: { success: boolean; error?: string }, status = 200) {
  return NextResponse.json(body, { status, headers: adminAuthHeaders });
}

async function readInput(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new RangeError('Body too large');
    }
    chunks.push(part.value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function adminCredentialPost<T>(
  request: Request,
  schema: z.ZodType<T>,
  run: (input: T) => Promise<NextResponse>,
) {
  if (!isSameOriginMutation(request))
    return adminAuthReply({ success: false, error: 'Request not allowed.' }, 403);
  try {
    const input = schema.parse(await readInput(request));
    if (budget.active >= 2)
      return adminAuthReply(
        { success: false, error: 'Admin access is busy. Please try again shortly.' },
        429,
      );
    budget.active++;
    try {
      return await run(input);
    } finally {
      budget.active--;
    }
  } catch (error) {
    if (error instanceof AdminCredentialError)
      return adminAuthReply({ success: false, error: error.message }, error.status);
    if (isAdminActionAuthError(error))
      return adminAuthReply(
        { success: false, error: error.message },
        error.code === 'admin_permission_denied' ? 403 : 401,
      );
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof RangeError)
      return adminAuthReply(
        { success: false, error: 'Check the password fields and try again.' },
        error instanceof RangeError ? 413 : 400,
      );
    console.warn('[admin-auth] Request temporarily unavailable');
    return adminAuthReply(
      { success: false, error: 'Admin access is temporarily unavailable. Please try again.' },
      503,
    );
  }
}
