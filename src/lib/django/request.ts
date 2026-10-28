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

export { readDjangoJson } from './read-json';

export function safeDjangoMessage(payload: unknown, fallback: string) {
  const message = getDjangoAuthErrorMessage(payload, fallback);
  return message.length <= 250 && !/[<>\r\n]/.test(message) ? message : fallback;
}
