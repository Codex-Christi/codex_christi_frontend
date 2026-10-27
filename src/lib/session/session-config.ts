import 'server-only';

import { resolveServerDjangoApiBaseUrl } from '../django/resolveServerDjangoApiBaseUrl';

export function getEncodedSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  const encoded = new TextEncoder().encode(secret);
  if (!secret || encoded.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes.');
  }
  return encoded;
}

export function getDjangoAuthRefreshPath() {
  const path = process.env.DJANGO_AUTH_REFRESH_PATH?.trim() || '/auth/token/refresh';
  if (!path.startsWith('/') || path.startsWith('//') || /[\\?#\s]/.test(path)) {
    throw new Error('Invalid Django auth refresh path.');
  }
  return path;
}

// Called at runtime, never at module import or during a secret-free image build.
export function assertAuthConfiguration() {
  getEncodedSessionSecret();
  const base = resolveServerDjangoApiBaseUrl();
  const url = new URL(base);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    /[\\?#\s\u0000-\u001f\u007f]/.test(base)
  ) {
    throw new Error('Invalid Django API base URL.');
  }
  getDjangoAuthRefreshPath();
}
