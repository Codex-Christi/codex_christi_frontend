import 'server-only';

import { getServerDjangoApiBaseUrl } from './getServerDjangoApiBaseUrl';
import { getDjangoAuthErrorMessage } from '../session/django-auth-response';

export function djangoRequest(path: string, init: RequestInit = {}, timeoutMs = 8000) {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path))
    throw new Error('Invalid Django API path.');
  return fetch(`${getServerDjangoApiBaseUrl()}${path}`, {
    ...init,
    cache: 'no-store',
    redirect: 'error',
    signal: init.signal ?? AbortSignal.timeout(timeoutMs),
  });
}

export async function readDjangoJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty Django response.');
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > 512 * 1024) {
      await reader.cancel();
      throw new Error('Django response is too large.');
    }
    chunks.push(part.value);
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(data));
}

export function safeDjangoMessage(payload: unknown, fallback: string) {
  const message = getDjangoAuthErrorMessage(payload, fallback);
  return message.length <= 250 && !/[<>\r\n]/.test(message) ? message : fallback;
}
